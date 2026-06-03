import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, Loader2, Check, Circle, ArrowRight, FileText, Pencil, CalendarClock, Info } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useConfig } from "@/lib/config";
import { PROSPECTS, findProspect, type Prospect } from "@/lib/prospects";
import {
  saveJSON, loadJSON,
  qualKey, structKey, priceKey, riskKey, contractKey, EXPRESS_SCHED_KEY,
} from "@/lib/store";
import { computePricing, defaultAssumptions, pricingLines, eur } from "@/lib/economics";

export const Route = createFileRoute("/express")({
  head: () => ({
    meta: [
      { title: "Express draft | SEE Origination Hub" },
      { name: "description", content: "Automated origination draft for review." },
    ],
  }),
  component: ExpressPage,
});

const STEPS = ["Qualification", "Structuring", "Pricing", "Risk & Credit", "Contracting", "Assembling pack"] as const;
type Phase = "idle" | "running" | "done";

// ---- Deterministic + sample builders (mock; mirrors the real sub-workflow outputs) ----
function buildQualification(p: Prospect, cfg: ReturnType<typeof useConfig>[0]) {
  const swing = Math.round(p.volumeGWh * 0.2);
  const targetMet = p.volumeGWh >= cfg.prospects.minVolumeGWh;
  const rec = !targetMet ? "Hold" : p.swing >= 80 ? "Proceed" : "Hold";
  return {
    company: p.name, recommendation: rec,
    rationale: `Fit driven by ${p.swing}/100 swing need; volume ${p.volumeGWh} GWh ${targetMet ? "meets" : "below"} target.`,
    fit: p.swing, fitGreen: cfg.prospects.fitGreen, fitAmber: cfg.prospects.fitAmber,
    volumeGWh: p.volumeGWh, minVol: cfg.prospects.minVolumeGWh, targetMet,
    indicativeSwingGWh: swing,
    assessment: {
      demandFit: `${p.sector} load is seasonal — a strong fit for storage-backed swing supply. (sample)`,
      sizing: `~${swing.toLocaleString()} GWh of winter swing is a meaningful, hedgeable parcel. (sample)`,
      keyRisk: `Credit standing (${p.credit}/100) is the main watch-item over the tenor. (sample)`,
    },
  };
}
function buildStructure(p: Prospect, hub: string) {
  const swing = Math.round(p.volumeGWh * 0.2);
  const base = p.volumeGWh - swing;
  return {
    company: p.name, structureType: "Supply + Storage seasonal swing contract",
    legs: [
      { component: "Supply (baseload)", detail: `${base.toLocaleString()} GWh/yr flat at ${hub}` },
      { component: "Storage (swing)", detail: `~${swing.toLocaleString()} GWh — inject Apr–Sep, withdraw Oct–Mar` },
      { component: "Transport / capacity", detail: `Entry-exit capacity to ${hub}` },
      { component: "Tenor", detail: "2 gas years (Oct–Sep)" },
      { component: "Indexation", detail: `${hub} month-ahead` },
    ],
    rationale: {
      structureRationale: "Supply + storage matches the winter-weighted demand shape. (sample)",
      swingProfile: "Inject in summer, withdraw across the winter peak. (sample)",
      optionality: "Storage spread provides extrinsic upside for SEE. (sample)",
      riskNote: "Watch withdrawal-rate constraints in peak weeks. (sample)",
    },
  };
}
function buildPricing(p: Prospect, hub: string) {
  const a = defaultAssumptions(hub);
  const pv = computePricing(p.volumeGWh, a);
  return {
    company: p.name, currency: "EUR", grossMargin: pv.gross,
    lines: pricingLines(hub, a, pv),
    narrative: {
      drivers: "Value is driven mainly by the summer–winter storage spread. (sample)",
      sensitivity: "Most sensitive to the seasonal spread; ±€1/MWh moves margin materially. (sample)",
      caveat: "Indicative only — uses default hub assumptions, not a live curve. (sample)",
    },
  };
}
function buildRisk(p: Prospect, hub: string) {
  const cv = p.volumeGWh * 1000 * 30;
  const pct = p.credit >= 85 ? 0.05 : p.credit >= 70 ? 0.12 : 0.2;
  const rating = p.credit >= 85 ? "Strong (A)" : p.credit >= 70 ? "Adequate (BBB)" : p.credit >= 60 ? "Watch (BB)" : "Weak (B)";
  return {
    company: p.name, rating,
    register: [
      { label: "Credit rating (indicative)", value: rating },
      { label: "Annual contract value", value: eur(cv) },
      { label: "Recommended collateral / PCG", value: `${eur(cv * pct)} (${Math.round(pct * 100)}%)` },
      { label: "Volumetric / swing risk", value: "~20% of volume is seasonal swing" },
      { label: "Basis risk", value: `${hub} delivery point` },
      { label: "Shape risk", value: "Winter-weighted withdrawal profile" },
    ],
    narrative: {
      riskSummary: "Moderate, well-understood physical risk. (sample)",
      creditView: `${rating} — collateral recommended to cover peak exposure. (sample)`,
      mitigants: "PCG / parent guarantee and monthly settlement. (sample)",
      kycNote: "Standard KYC; no adverse findings. (sample)",
    },
  };
}
function buildContract(p: Prospect, hub: string) {
  const swing = Math.round(p.volumeGWh * 0.2);
  return {
    company: p.name,
    terms: [
      { label: "Counterparty", value: p.name },
      { label: "Product", value: "Gas supply + storage (seasonal swing)" },
      { label: "Delivery point", value: hub },
      { label: "Annual contract quantity", value: `${p.volumeGWh.toLocaleString()} GWh/yr` },
      { label: "Swing volume", value: `~${swing.toLocaleString()} GWh` },
      { label: "Tenor", value: "2 gas years (Oct–Sep)" },
      { label: "Master agreement", value: "EFET General Agreement + confirmation" },
    ],
    draft: {
      draftSummary: "Standard EFET supply + storage confirmation. (sample)",
      offMarket: "No off-market terms detected. (sample)",
      redline: "Propose a volume tolerance band of ±5%. (sample)",
    },
  };
}

function ExpressPage() {
  const [cfg] = useConfig();
  const [company, setCompany] = useState<string>(PROSPECTS[0].name);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [schedule, setSchedule] = useState<"Off" | "Nightly" | "Weekly">("Off");

  useEffect(() => {
    setSchedule(loadJSON<"Off" | "Nightly" | "Weekly">(EXPRESS_SCHED_KEY) ?? "Off");
  }, []);

  const prospect = findProspect(company)!;

  const run = () => {
    setPhase("running");
    setStepIdx(0);
    // Persist all sections up front (so "go back to a step" works in the existing screens).
    saveJSON(qualKey(company), buildQualification(prospect, cfg));
    saveJSON(structKey(company), buildStructure(prospect, cfg.market.hub));
    saveJSON(priceKey(company), buildPricing(prospect, cfg.market.hub));
    saveJSON(riskKey(company), buildRisk(prospect, cfg.market.hub));
    saveJSON(contractKey(company), buildContract(prospect, cfg.market.hub));
    // Simulate the orchestrator ticking through each step.
    let i = 0;
    const tick = () => {
      i += 1;
      setStepIdx(i);
      if (i < STEPS.length) setTimeout(tick, 650);
      else setPhase("done");
    };
    setTimeout(tick, 650);
  };

  const setSched = (v: "Off" | "Nightly" | "Weekly") => {
    setSchedule(v);
    saveJSON(EXPRESS_SCHED_KEY, v);
  };
  const nextRun = schedule === "Nightly" ? "tonight 02:00" : schedule === "Weekly" ? "Monday 06:00" : "—";

  const price = buildPricing(prospect, cfg.market.hub);
  const struct = buildStructure(prospect, cfg.market.hub);
  const risk = buildRisk(prospect, cfg.market.hub);
  const qual = buildQualification(prospect, cfg);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Express" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">Express draft — automated path</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Mock</span>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Run the origination cycle automatically</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          One orchestrated run drafts every stage and assembles a deal pack for you to review, edit, or send for approval.
          The human decision and approval gates are preserved — this never auto-books.
        </p>

        {/* Controls */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <label className="text-xs font-medium text-muted-foreground">Counterparty</label>
            <select
              value={company}
              onChange={(e) => { setCompany(e.target.value); setPhase("idle"); setStepIdx(-1); }}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {PROSPECTS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Schedule:</span>
              {(["Off", "Nightly", "Weekly"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSched(v)}
                  className={`rounded-md border px-2 py-0.5 ${schedule === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-accent"}`}
                >
                  {v}
                </button>
              ))}
              <span className="ml-1">Next run: <span className="font-medium text-foreground">{nextRun}</span></span>
            </div>
          </div>
          <button
            onClick={run}
            disabled={phase === "running"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {phase === "done" ? "Re-run Express draft" : "Run Express draft"}
          </button>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Demo mock — progress and AI text are simulated. The real orchestrator (webhook + nightly Schedule Trigger, chaining the qualify/structure/price/risk/contract workflows) is provided as an importable n8n workflow.
        </div>

        {/* Progress */}
        {phase !== "idle" && (
          <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orchestrator run</h2>
            <ol className="mt-3 space-y-2">
              {STEPS.map((s, i) => {
                const done = stepIdx > i || phase === "done";
                const active = stepIdx === i && phase === "running";
                return (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    {done ? <Check className="h-4 w-4 text-emerald-600" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    <span className={done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Deal pack review */}
        {phase === "done" && (
          <section className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Deal pack — {company}</h2>
            </div>

            <PackCard title="Qualification" editTo="/stage-3" company={company}
              rows={[["AI suggestion", qual.recommendation], ["Fit", String(qual.fit)], ["Demand fit", qual.assessment.demandFit]]} />
            <PackCard title="Structure" editTo="/deal" company={company}
              rows={struct.legs.slice(0, 3).map((l) => [l.component, l.detail] as [string, string])} />
            <PackCard title="Pricing" editTo="/deal" company={company}
              rows={[["Indicative gross margin", eur(price.grossMargin)], ["Drivers", price.narrative.drivers]]} />
            <PackCard title="Risk & Credit" editTo="/deal" company={company}
              rows={[["Rating", risk.rating], ["Summary", risk.narrative.riskSummary]]} />
            <PackCard title="Contracting" editTo="/stage-7" company={company}
              rows={[["Master", "EFET General Agreement"], ["Redline", buildContract(prospect, cfg.market.hub).draft.redline]]} />

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/stage-8"
                search={{ company }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Send for approval <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/stage-3"
                search={{ company }}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil className="h-4 w-4" /> Review / edit from the start
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Each section is saved to the deal, so "Edit step" opens the normal stage where you can change anything before approval.
            </p>
          </section>
        )}

        <div className="mt-10">
          <Link to="/deals" className="text-sm text-muted-foreground hover:text-foreground">← Back to deals</Link>
        </div>
      </main>
    </div>
  );
}

function PackCard({ title, rows, editTo, company }: { title: string; rows: [string, string][]; editTo: "/stage-3" | "/deal" | "/stage-7"; company: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Link
          to={editTo}
          search={{ company }}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit step
        </Link>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-border first:border-t-0 align-top">
              <th className="w-44 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</th>
              <td className="px-4 py-2.5 text-foreground/90">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
