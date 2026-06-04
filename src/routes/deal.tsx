import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight, Layers, Coins, ShieldCheck, RotateCcw, CheckCircle2, Download, Mail } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, structKey, priceKey, priceAssumKey, riskKey } from "@/lib/store";
import { type Assumptions, defaultAssumptions, computePricing, pricingLines, eur } from "@/lib/economics";
import { buildDocHtml, downloadDoc, emailDoc, type Section } from "@/lib/docexport";

const STRUCT_URL = "http://localhost:5678/webhook/structure";
const PRICE_URL = "http://localhost:5678/webhook/price";
const RISK_URL = "http://localhost:5678/webhook/risk";

export const Route = createFileRoute("/deal")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Deal Analysis | SEE Origination Hub" },
      { name: "description", content: "Structure, pricing and risk in one workspace." },
    ],
  }),
  component: Deal,
});

type Leg = { component: string; detail: string };
type Line = { label: string; value: string };
type Structure = {
  company: string;
  structureType: string;
  legs: Leg[];
  rationale: { structureRationale: string; swingProfile: string; optionality: string; riskNote: string };
};
type Pricing = {
  company: string;
  currency: string;
  lines: Line[];
  grossMargin: number;
  narrative: { drivers: string; sensitivity: string; caveat: string };
};
type Risk = {
  company: string;
  rating: string;
  register: Line[];
  narrative: { riskSummary: string; creditView: string; mitigants: string; kycNote: string };
};

type Step = "idle" | "loading" | "done";
type Tab = "structure" | "pricing" | "risk";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function AiRows({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, val]) => (
          <tr key={label} className="border-t border-border first:border-t-0 align-top">
            <th className="w-52 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                {label}
              </span>
            </th>
            <td className="px-4 py-3 text-foreground/90">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KvTable({ rows, highlightLabel }: { rows: Line[]; highlightLabel?: string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((l) => {
          const hot = highlightLabel && l.label.toLowerCase().includes(highlightLabel);
          return (
            <tr key={l.label} className={`border-t border-border first:border-t-0 ${hot ? "bg-secondary/40" : ""}`}>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {l.label}
              </th>
              <td className={`px-4 py-3 text-right ${hot ? "text-base font-bold text-foreground" : "font-medium text-foreground/90"}`}>
                {l.value}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Deal() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [tab, setTab] = useState<Tab>("structure");
  const [sStatus, setSStatus] = useState<Step>("idle");
  const [pStatus, setPStatus] = useState<Step>("idle");
  const [rStatus, setRStatus] = useState<Step>("idle");
  const [structure, setStructure] = useState<Structure | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assum, setAssum] = useState<Assumptions>(defaultAssumptions(cfg.market.hub));
  const running = sStatus === "loading" || pStatus === "loading" || rStatus === "loading";
  const anyDone = !!(structure || pricing || risk);
  const pv = prospect ? computePricing(prospect.volumeGWh, assum) : null;

  // Restore cached results.
  useEffect(() => {
    if (!company) return;
    const s = loadJSON<Structure>(structKey(company));
    const p = loadJSON<Pricing>(priceKey(company));
    const r = loadJSON<Risk>(riskKey(company));
    const a = loadJSON<Assumptions>(priceAssumKey(company));
    setAssum(a ?? defaultAssumptions(cfg.market.hub));
    // Only accept well-formed cached results; ignore stale/older-shaped data so we never crash on a missing array.
    if (s && Array.isArray(s.legs) && s.rationale) { setStructure(s); setSStatus("done"); } else { setStructure(null); setSStatus("idle"); }
    if (p && Array.isArray(p.lines) && p.narrative) { setPricing(p); setPStatus("done"); } else { setPricing(null); setPStatus("idle"); }
    if (r && Array.isArray(r.register) && r.narrative) { setRisk(r); setRStatus("done"); } else { setRisk(null); setRStatus("idle"); }
  }, [company]);

  // Edit an assumption: persist it, and recompute the saved valuation so downstream stages stay consistent.
  const updateAssum = (patch: Partial<Assumptions>) => {
    if (!prospect) return;
    const next = { ...assum, ...patch };
    setAssum(next);
    saveJSON(priceAssumKey(prospect.name), next);
    if (pricing) {
      const npv = computePricing(prospect.volumeGWh, next);
      const np: Pricing = { ...pricing, grossMargin: npv.gross, lines: pricingLines(cfg.market.hub, next, npv) };
      setPricing(np);
      saveJSON(priceKey(prospect.name), np);
    }
  };

  const fbStructure = (): Structure => {
    const swing = Math.round(prospect!.volumeGWh * 0.2);
    const base = prospect!.volumeGWh - swing;
    return {
      company: prospect!.name,
      structureType: "Supply + Storage seasonal swing contract",
      legs: [
        { component: "Supply (baseload)", detail: `${base.toLocaleString()} GWh/yr flat at ${cfg.market.hub}` },
        { component: "Storage (swing)", detail: `~${swing.toLocaleString()} GWh — inject Apr–Sep, withdraw Oct–Mar` },
        { component: "Transport / capacity", detail: `Entry-exit capacity to ${cfg.market.hub}` },
        { component: "Tenor", detail: "2 gas years (Oct–Sep)" },
        { component: "Indexation", detail: `${cfg.market.hub} month-ahead` },
      ],
      rationale: { structureRationale: "AI unavailable.", swingProfile: "AI unavailable.", optionality: "AI unavailable.", riskNote: "AI unavailable." },
    };
  };
  const fbRisk = (): Risk => {
    const annual = prospect!.volumeGWh;
    const cv = annual * 1000 * 30;
    const pct = prospect!.credit >= 85 ? 0.05 : prospect!.credit >= 70 ? 0.12 : 0.2;
    const rating = prospect!.credit >= 85 ? "Strong (A)" : prospect!.credit >= 70 ? "Adequate (BBB)" : prospect!.credit >= 60 ? "Watch (BB)" : "Weak (B)";
    return {
      company: prospect!.name, rating,
      register: [
        { label: "Credit rating (indicative)", value: rating },
        { label: "Annual contract value", value: eur(cv) },
        { label: "Recommended collateral / PCG", value: `${eur(cv * pct)} (${Math.round(pct * 100)}%)` },
        { label: "Volumetric / swing risk", value: "~20% of volume is seasonal swing" },
        { label: "Basis risk", value: `${cfg.market.hub} delivery point` },
        { label: "Shape risk", value: "Winter-weighted withdrawal profile" },
      ],
      narrative: { riskSummary: "AI unavailable.", creditView: "AI unavailable.", mitigants: "AI unavailable.", kycNote: "AI unavailable." },
    };
  };

  const runAll = async () => {
    if (!prospect) return;
    const config = readConfig();
    const payload = { config, prospect };
    setErrors({});

    // Sequential — respects the single local model, and lets each tab fill as it lands.
    setTab("structure"); setSStatus("loading");
    try {
      let s = await post<any>(STRUCT_URL, payload);
      if (Array.isArray(s)) s = s[0];               // n8n sometimes wraps the response in an array
      if (s && s.json) s = s.json;                  // …or in an item envelope
      if (!s || !Array.isArray(s.legs) || !s.rationale) throw new Error("Malformed structure response");
      setStructure(s as Structure); saveJSON(structKey(prospect.name), s);
    }
    catch (e) { const s = fbStructure(); setStructure(s); saveJSON(structKey(prospect.name), s); setErrors((x) => ({ ...x, structure: (e as Error).message })); }
    setSStatus("done");

    setPStatus("loading");
    {
      const pvNow = computePricing(prospect.volumeGWh, assum);
      const lines = pricingLines(cfg.market.hub, assum, pvNow);
      try {
        let p = await post<any>(PRICE_URL, { config, prospect, assumptions: assum });
        if (Array.isArray(p)) p = p[0];
        if (p && p.json) p = p.json;
        if (!p || !p.narrative) throw new Error("Malformed pricing response");
        const np: Pricing = { company: prospect.name, currency: "EUR", grossMargin: pvNow.gross, lines, narrative: p.narrative };
        setPricing(np); saveJSON(priceKey(prospect.name), np);
      } catch (e) {
        const np: Pricing = { company: prospect.name, currency: "EUR", grossMargin: pvNow.gross, lines, narrative: { drivers: "AI narrative unavailable.", sensitivity: "AI narrative unavailable.", caveat: "AI narrative unavailable." } };
        setPricing(np); saveJSON(priceKey(prospect.name), np); setErrors((x) => ({ ...x, pricing: (e as Error).message }));
      }
    }
    setPStatus("done");

    setRStatus("loading");
    try {
      let r = await post<any>(RISK_URL, payload);
      if (Array.isArray(r)) r = r[0];
      if (r && r.json) r = r.json;
      if (!r || !Array.isArray(r.register) || !r.narrative) throw new Error("Malformed risk response");
      setRisk(r as Risk); saveJSON(riskKey(prospect.name), r);
    }
    catch (e) { const r = fbRisk(); setRisk(r); saveJSON(riskKey(prospect.name), r); setErrors((x) => ({ ...x, risk: (e as Error).message })); }
    setRStatus("done");
  };

  const exportSections = (): Section[] => {
    const secs: Section[] = [];
    if (structure) {
      secs.push({ heading: `Structure — ${structure.structureType}`, rows: structure.legs.map((l) => [l.component, l.detail] as [string, string]) });
      secs.push({ heading: "AI structuring rationale", paragraphs: [
        ["Why this structure", structure.rationale.structureRationale],
        ["Seasonal swing profile", structure.rationale.swingProfile],
        ["Embedded optionality", structure.rationale.optionality],
        ["Structuring risk", structure.rationale.riskNote],
      ] });
    }
    if (pricing) {
      secs.push({ heading: "Pricing — valuation breakdown", rows: pricing.lines.map((l) => [l.label, l.value] as [string, string]) });
      secs.push({ heading: "AI valuation narrative", paragraphs: [
        ["Value drivers", pricing.narrative.drivers],
        ["Key sensitivity", pricing.narrative.sensitivity],
        ["Assumption caveat", pricing.narrative.caveat],
      ] });
    }
    if (risk) {
      secs.push({ heading: "Risk & credit register", rows: risk.register.map((l) => [l.label, l.value] as [string, string]) });
      secs.push({ heading: "AI risk assessment", paragraphs: [
        ["Overall risk", risk.narrative.riskSummary],
        ["Credit view", risk.narrative.creditView],
        ["Recommended mitigants", risk.narrative.mitigants],
        ["KYC note", risk.narrative.kycNote],
      ] });
    }
    return secs;
  };
  const onDownload = () => downloadDoc(`SEE-DealAnalysis-${company.replace(/[^a-z0-9]+/gi, "-")}`, buildDocHtml(`Deal Analysis — ${company}`, `${cfg.market.commodity} · ${cfg.market.hub}`, exportSections()));
  const onEmail = () => emailDoc(`SEE Origination — Deal Analysis — ${company}`, exportSections());

  const stepperFor: Record<Tab, number> = { structure: 4, pricing: 5, risk: 6 };

  const TABS: { id: Tab; label: string; icon: typeof Layers; st: Step }[] = [
    { id: "structure", label: "Structure", icon: Layers, st: sStatus },
    { id: "pricing", label: "Pricing", icon: Coins, st: pStatus },
    { id: "risk", label: "Risk & Credit", icon: ShieldCheck, st: rStatus },
  ];

  const StatusDot = ({ st }: { st: Step }) => {
    if (st === "loading") return <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />;
    const color = st === "done" ? "bg-emerald-500" : "bg-muted-foreground/30";
    return <span className={`h-2 w-2 rounded-full ${color}`} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Deal Analysis" current={stepperFor[tab]} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">Deal analysis</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Structure, price &amp; risk
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          One orchestrated run builds the structure, values it, and assesses risk &amp; credit —
          results stream into the tabs below as each step completes.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back to qualification and choose one.
          </div>
        )}

        {prospect && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold text-foreground">{prospect.name}</span>
                <span className="text-muted-foreground">
                  {" "}· {prospect.sector} · {prospect.volumeGWh.toLocaleString()} GWh/yr · {cfg.market.hub}
                </span>
              </div>
              <button
                onClick={runAll}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {running && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
                {anyDone ? "Re-run deal analysis" : "Run deal analysis"}
              </button>
            </div>

            {/* Tabs — segmented control */}
            <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary/40 p-1.5">
              {TABS.map((t) => {
                const active = tab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      active
                        ? "border border-border bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.label.split(" ")[0]}</span>
                    <StatusDot st={t.st} />
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-6">
              {/* STRUCTURE TAB */}
              {tab === "structure" && (
                sStatus === "idle" ? (
                  <p className="text-sm text-muted-foreground">Run the analysis to generate the structure.</p>
                ) : sStatus === "loading" && !structure ? (
                  <p className="text-sm text-muted-foreground">Assembling legs and drafting rationale…</p>
                ) : structure && Array.isArray(structure.legs) && structure.rationale ? (
                  <>
                    {errors.structure && <Warn msg={errors.structure} />}
                    <Card title={`Indicative term sheet — ${structure.structureType}`}>
                      <KvTable rows={structure.legs.map((l) => ({ label: l.component, value: l.detail }))} />
                    </Card>
                    <Card title="Structuring guardrails">
                      <div className="space-y-2 p-4 text-sm">
                        <Guard
                          ok={2 <= cfg.guardrails.liquidCurveYears}
                          label="Tenor vs liquid forward curve"
                          value={`2 gas years vs liquid ${cfg.guardrails.liquidCurveYears}y`}
                          flag="Beyond liquid curve — pricing / volatility risk"
                        />
                        <Guard
                          ok={assum.swingPct >= cfg.guardrails.minVolumeFlexPct}
                          label="Volume flexibility"
                          value={`${assum.swingPct}% swing vs min ${cfg.guardrails.minVolumeFlexPct}%`}
                          flag="Too rigid — limited optionality to monetise"
                        />
                      </div>
                      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                        Soft guardrails — they flag risk for human review, they don't block the deal.
                      </p>
                    </Card>
                    <Card title="AI structuring rationale" ai>
                      <AiRows rows={[
                        ["Why this structure", structure.rationale.structureRationale],
                        ["Seasonal swing profile", structure.rationale.swingProfile],
                        ["Embedded optionality", structure.rationale.optionality],
                        ["Structuring risk", structure.rationale.riskNote],
                      ]} />
                    </Card>
                  </>
                ) : null
              )}

              {/* PRICING TAB */}
              {tab === "pricing" && (
                pStatus === "idle" ? (
                  <p className="text-sm text-muted-foreground">Pricing runs after the structure.</p>
                ) : pStatus === "loading" && !pricing ? (
                  <p className="text-sm text-muted-foreground">Valuing the storage swing…</p>
                ) : pricing && pv ? (
                  <>
                    {errors.pricing && <Warn msg={errors.pricing} />}

                    {/* Editable assumptions */}
                    <Card title="Assumptions (editable — indicative only)">
                      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Assum label={`Spread (${cfg.market.hub} S/W) €/MWh`} value={assum.spread} step={0.1} onChange={(v) => updateAssum({ spread: v })} />
                        <Assum label="Swing % of volume" value={assum.swingPct} step={1} onChange={(v) => updateAssum({ swingPct: v })} />
                        <Assum label="Extrinsic uplift %" value={assum.extrinsicPct} step={1} onChange={(v) => updateAssum({ extrinsicPct: v })} />
                        <Assum label="Supply margin €/MWh" value={assum.supplyMargin} step={0.05} onChange={(v) => updateAssum({ supplyMargin: v })} />
                      </div>
                      <div className="flex items-center justify-between border-t border-border px-4 py-2">
                        <button
                          onClick={() => updateAssum(defaultAssumptions(cfg.market.hub))}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset to hub defaults
                        </button>
                        <span className="text-xs text-muted-foreground">Numbers update live; AI narrative reflects the last run.</span>
                      </div>
                    </Card>

                    <Card title="Valuation breakdown">
                      <KvTable rows={pricingLines(cfg.market.hub, assum, pv)} highlightLabel="gross margin" />
                    </Card>

                    {/* Sensitivity */}
                    <Card title="Sensitivity — gross margin vs seasonal spread">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left">Spread</th>
                            <th className="px-4 py-2 text-right">−€1.00</th>
                            <th className="px-4 py-2 text-right">Base (€{assum.spread.toFixed(2)})</th>
                            <th className="px-4 py-2 text-right">+€1.00</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-border">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gross margin</th>
                            <td className="px-4 py-3 text-right text-foreground/90">{eur(computePricing(prospect!.volumeGWh, { ...assum, spread: Math.max(0, assum.spread - 1) }).gross)}</td>
                            <td className="px-4 py-3 text-right font-bold text-foreground">{eur(pv.gross)}</td>
                            <td className="px-4 py-3 text-right text-foreground/90">{eur(computePricing(prospect!.volumeGWh, { ...assum, spread: assum.spread + 1 }).gross)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </Card>

                    <Card title="AI valuation narrative" ai>
                      <AiRows rows={[
                        ["Value drivers", pricing.narrative.drivers],
                        ["Key sensitivity", pricing.narrative.sensitivity],
                        ["Assumption caveat", pricing.narrative.caveat],
                      ]} />
                    </Card>
                  </>
                ) : null
              )}

              {/* RISK TAB */}
              {tab === "risk" && (
                rStatus === "idle" ? (
                  <p className="text-sm text-muted-foreground">Risk &amp; credit runs after pricing.</p>
                ) : rStatus === "loading" && !risk ? (
                  <p className="text-sm text-muted-foreground">Computing exposure and drafting the assessment…</p>
                ) : risk ? (
                  <>
                    {errors.risk && <Warn msg={errors.risk} />}
                    <Card title="Risk & credit register">
                      <KvTable rows={risk.register} />
                    </Card>
                    <Card title="AI risk assessment" ai>
                      <AiRows rows={[
                        ["Overall risk", risk.narrative.riskSummary],
                        ["Credit view", risk.narrative.creditView],
                        ["Recommended mitigants", risk.narrative.mitigants],
                        ["KYC note", risk.narrative.kycNote],
                      ]} />
                    </Card>
                  </>
                ) : null
              )}
            </div>

            {sStatus === "done" && pStatus === "done" && rStatus === "done" && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/stage-7"
                  search={{ company: prospect.name }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Proceed to contracting
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={onDownload}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  onClick={onEmail}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link to="/stage-3" search={{ company }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to qualification
          </Link>
        </div>
      </main>
    </div>
  );
}

function Card({ title, ai, children }: { title: string; ai?: boolean; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-3">
        {ai && <Sparkles className="h-3.5 w-3.5 text-accent" />}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Warn({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      AI narrative unavailable — numbers shown are computed from your assumptions. ({msg})
    </div>
  );
}

function Guard({ ok, label, value, flag }: { ok: boolean; label: string; value: string; flag: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        <span className="text-foreground">{label}</span>
      </span>
      <span className="text-right">
        <span className="block text-foreground/80">{value}</span>
        {!ok && <span className="block text-xs font-medium text-amber-700">{flag}</span>}
      </span>
    </div>
  );
}

function Assum({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
    </label>
  );
}
