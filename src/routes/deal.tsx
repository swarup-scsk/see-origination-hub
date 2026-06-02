import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight, Layers, Coins, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, structKey, priceKey, riskKey } from "@/lib/store";

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
const eur = (n: number) => "€" + Math.round(n).toLocaleString();

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
  const running = sStatus === "loading" || pStatus === "loading" || rStatus === "loading";
  const anyDone = !!(structure || pricing || risk);

  // Restore cached results.
  useEffect(() => {
    if (!company) return;
    const s = loadJSON<Structure>(structKey(company));
    const p = loadJSON<Pricing>(priceKey(company));
    const r = loadJSON<Risk>(riskKey(company));
    if (s) { setStructure(s); setSStatus("done"); }
    if (p) { setPricing(p); setPStatus("done"); }
    if (r) { setRisk(r); setRStatus("done"); }
  }, [company]);

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
  const fbPricing = (): Pricing => {
    const annual = prospect!.volumeGWh;
    const swing = Math.round(annual * 0.2);
    const base = annual - swing;
    const spread = 4.2;
    const intrinsic = swing * 1000 * spread;
    const extrinsic = intrinsic * 0.25;
    const supply = base * 1000 * 0.3;
    const gross = intrinsic + extrinsic + supply;
    return {
      company: prospect!.name, currency: "EUR", grossMargin: gross,
      lines: [
        { label: `Seasonal spread (${cfg.market.hub} S/W)`, value: `€${spread.toFixed(2)}/MWh` },
        { label: "Storage swing volume", value: `${swing.toLocaleString()} GWh` },
        { label: "Intrinsic storage value", value: eur(intrinsic) },
        { label: "Extrinsic (optionality, ~25%)", value: eur(extrinsic) },
        { label: "Supply baseload margin", value: eur(supply) },
        { label: "Indicative gross margin", value: eur(gross) },
      ],
      narrative: { drivers: "AI unavailable.", sensitivity: "AI unavailable.", caveat: "AI unavailable." },
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
    try { const s = await post<Structure>(STRUCT_URL, payload); setStructure(s); saveJSON(structKey(prospect.name), s); }
    catch (e) { const s = fbStructure(); setStructure(s); saveJSON(structKey(prospect.name), s); setErrors((x) => ({ ...x, structure: (e as Error).message })); }
    setSStatus("done");

    setTab("pricing"); setPStatus("loading");
    try { const p = await post<Pricing>(PRICE_URL, payload); setPricing(p); saveJSON(priceKey(prospect.name), p); }
    catch (e) { const p = fbPricing(); setPricing(p); saveJSON(priceKey(prospect.name), p); setErrors((x) => ({ ...x, pricing: (e as Error).message })); }
    setPStatus("done");

    setTab("risk"); setRStatus("loading");
    try { const r = await post<Risk>(RISK_URL, payload); setRisk(r); saveJSON(riskKey(prospect.name), r); }
    catch (e) { const r = fbRisk(); setRisk(r); saveJSON(riskKey(prospect.name), r); setErrors((x) => ({ ...x, risk: (e as Error).message })); }
    setRStatus("done");
  };

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
                ) : structure ? (
                  <>
                    {errors.structure && <Warn msg={errors.structure} />}
                    <Card title={`Indicative term sheet — ${structure.structureType}`}>
                      <KvTable rows={structure.legs.map((l) => ({ label: l.component, value: l.detail }))} />
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
                ) : pricing ? (
                  <>
                    {errors.pricing && <Warn msg={errors.pricing} />}
                    <Card title="Valuation breakdown">
                      <KvTable rows={pricing.lines} highlightLabel="gross margin" />
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
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/stage-7"
                  search={{ company: prospect.name }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Proceed to contracting
                  <ArrowRight className="h-4 w-4" />
                </Link>
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
      Workflow unavailable — showing computed values only. ({msg})
    </div>
  );
}
