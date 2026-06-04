import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, X, RotateCcw, Trash2, Layers } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  useStore,
  DEFAULT_CONFIG,
  deepGet,
  SCENARIO_OPTIONS,
  MARKET_OPTIONS,
  type ConfigStore,
  type Scope,
  type Override,
} from "@/lib/config";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configuration | SEE Origination Hub" },
      { name: "description", content: "Global and stage-by-stage business rules." },
    ],
  }),
  component: ConfigPage,
});

type FieldType = "number" | "bool" | "select";
type FieldDef = { path: string; label: string; type: FieldType; options?: string[]; step?: number; baseOnly?: boolean; hint?: string };

const SECTIONS: { id: string; label: string; note: string; global?: boolean }[] = [
  { id: "global", label: "Global rules", note: "Rules that apply across the entire lifecycle. Every stage inherits these; a stage or a scoped override can refine them.", global: true },
  { id: "scenario", label: "1 · Scenario", note: "Weights used to rank the candidate deal-type scenarios." },
  { id: "prospecting", label: "2 · Prospecting", note: "Scoring weights and thresholds for ranking counterparties." },
  { id: "qualification", label: "3 · Qualification", note: "Inherits the financial gate (Global) and the fit thresholds (Prospecting). No stage-specific rules." },
  { id: "structuring", label: "4 · Structuring", note: "Soft guardrails flagged while building the deal." },
  { id: "pricing", label: "5 · Pricing", note: "Valuation assumptions are set per deal on the Deal Analysis screen; this stage inherits the financial gate." },
  { id: "risk", label: "6 · Risk & Credit", note: "Inherits the compliance threshold; credit rating tiers are built in." },
  { id: "contracting", label: "7 · Contracting", note: "Inherits market scope; uses the European Federation of Energy Traders (EFET) template." },
  { id: "approval", label: "8 · Approval & Compliance", note: "Inherits the single-deal notional alert (Global); named sign-offs are recorded at the stage." },
  { id: "lifecycle", label: "9 · Lifecycle", note: "No stage-specific rules." },
];

const SECTION_FIELDS: Record<string, FieldDef[]> = {
  global: [
    { path: "market.commodity", label: "Commodity", type: "select", options: ["Gas", "Power"], baseOnly: true },
    { path: "market.region", label: "Region", type: "select", options: MARKET_OPTIONS, baseOnly: true },
    { path: "market.hub", label: "Price hub", type: "select", options: ["TTF", "THE", "PEG", "PSV"], baseOnly: true },
    { path: "financialGate.enabled", label: "Financial gate enabled", type: "bool" },
    { path: "financialGate.minGrossMarginEur", label: "Min indicative gross margin (€) — hard reject below", type: "number", step: 50000 },
    { path: "compliance.singleDealNotionalAlertEur", label: "Single-deal notional alert (€)", type: "number", step: 100000 },
  ],
  scenario: [
    { path: "scenarioWeights.strategicFit", label: "Strategic fit", type: "number", step: 5 },
    { path: "scenarioWeights.profitabilityPotential", label: "Profitability potential", type: "number", step: 5 },
    { path: "scenarioWeights.portfolioSynergy", label: "Portfolio synergy", type: "number", step: 5 },
    { path: "scenarioWeights.dealComplexity", label: "Deal complexity", type: "number", step: 5 },
    { path: "scenarioWeights.dataAvailability", label: "Data availability", type: "number", step: 5 },
  ],
  prospecting: [
    { path: "prospects.minVolumeGWh", label: "Target minimum annual volume (GWh)", type: "number", step: 50 },
    { path: "prospects.fitGreen", label: "Strong (green) fit score ≥", type: "number", step: 1 },
    { path: "prospects.fitAmber", label: "Consider (amber) fit score ≥", type: "number", step: 1 },
    { path: "prospects.weights.swing", label: "Weight — swing need", type: "number", step: 5 },
    { path: "prospects.weights.credit", label: "Weight — creditworthiness", type: "number", step: 5 },
    { path: "prospects.weights.volume", label: "Weight — volume", type: "number", step: 5 },
    { path: "prospects.weights.strategic", label: "Weight — strategic fit", type: "number", step: 5 },
  ],
  structuring: [
    { path: "guardrails.liquidCurveYears", label: "Liquid forward curve (years)", type: "number", step: 1 },
    { path: "guardrails.minVolumeFlexPct", label: "Minimum volume flexibility (%)", type: "number", step: 1 },
  ],
};

const numberCls = "w-44 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";
const selectCls = numberCls;
const eur = (n: number) => "€" + Math.round(n).toLocaleString();

function sameScope(a: Scope, b: Scope) {
  return (a.dealType || "") === (b.dealType || "") && (a.scenario || "") === (b.scenario || "") && (a.market || "") === (b.market || "");
}
function fmtVal(f: FieldDef, v: unknown) {
  if (f.type === "bool") return v ? "On" : "Off";
  if (f.path.endsWith("Eur")) return eur(Number(v));
  return String(v);
}

function ConfigPage() {
  const router = useRouter();
  const [store, setStore] = useStore();
  const [ctx, setCtx] = useState<{ dealType: string; scenario: string; market: string }>({ dealType: "", scenario: "", market: "" });

  const isBase = !ctx.dealType && !ctx.scenario && !ctx.market;
  const scopeObj = (): Scope => ({
    ...(ctx.dealType ? { dealType: ctx.dealType } : {}),
    ...(ctx.scenario ? { scenario: ctx.scenario } : {}),
    ...(ctx.market ? { market: ctx.market } : {}),
  });
  const currentOverride = () => store.overrides.find((o) => sameScope(o.scope, scopeObj()));

  const setBaseField = (path: string, val: unknown) => {
    const base = structuredClone(store.base);
    const keys = path.split(".");
    let o: any = base;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = val;
    setStore({ ...store, base });
  };
  const setOverrideField = (path: string, val: number | string | boolean) => {
    const so = scopeObj();
    const overrides: Override[] = store.overrides.map((o) => ({ ...o, values: { ...o.values } }));
    let layer = overrides.find((o) => sameScope(o.scope, so));
    if (!layer) {
      layer = { id: crypto.randomUUID(), scope: so, values: {} };
      overrides.push(layer);
    }
    layer.values[path] = val;
    setStore({ ...store, overrides });
  };
  const clearOverrideField = (path: string) => {
    const so = scopeObj();
    let overrides: Override[] = store.overrides.map((o) => ({ ...o, values: { ...o.values } }));
    const layer = overrides.find((o) => sameScope(o.scope, so));
    if (layer) {
      delete layer.values[path];
      if (Object.keys(layer.values).length === 0) overrides = overrides.filter((o) => o !== layer);
    }
    setStore({ ...store, overrides });
  };
  const removeOverride = (id: string) => setStore({ ...store, overrides: store.overrides.filter((o) => o.id !== id) });
  const resetAll = () => setStore({ base: DEFAULT_CONFIG, overrides: [] });

  const inputFor = (f: FieldDef, value: unknown, onChange: (v: number | string | boolean) => void) => {
    if (f.type === "bool")
      return <input type="checkbox" className="h-4 w-4" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    if (f.type === "select")
      return (
        <select className={selectCls} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    return <input type="number" step={f.step ?? 1} className={numberCls} value={Number(value)} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />;
  };

  const renderField = (f: FieldDef) => {
    const inherited = deepGet(store.base, f.path);
    if (isBase || f.baseOnly) {
      if (!isBase && f.baseOnly) {
        return (
          <Row key={f.path} label={f.label}>
            <span className="text-sm text-muted-foreground">{fmtVal(f, inherited)} <span className="text-xs">(global)</span></span>
          </Row>
        );
      }
      return <Row key={f.path} label={f.label}>{inputFor(f, inherited, (v) => setBaseField(f.path, v))}</Row>;
    }
    const ov = currentOverride();
    const overridden = !!ov && Object.prototype.hasOwnProperty.call(ov.values, f.path);
    const val = overridden ? ov!.values[f.path] : inherited;
    return (
      <div key={f.path} className="border-b border-border py-3 last:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">{f.label}</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5"
              checked={overridden}
              onChange={(e) => (e.target.checked ? setOverrideField(f.path, val as number | string | boolean) : clearOverrideField(f.path))}
            />
            Override here
          </label>
        </div>
        <div className="mt-2">
          {overridden ? (
            inputFor(f, val, (v) => setOverrideField(f.path, v))
          ) : (
            <span className="text-xs text-muted-foreground">Inherits global: <span className="font-medium text-foreground">{fmtVal(f, inherited)}</span></span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Configuration" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuration — Business Rules</h1>
            <p className="mt-1 text-sm text-muted-foreground">All global and stage rules on one page. Select a scope to qualify rules by deal type, scenario or market.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={resetAll} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <RotateCcw className="h-4 w-4" /> Reset all
            </button>
            <button onClick={() => router.history.back()} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <X className="h-4 w-4" /> Done
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
          {/* Sidebar - anchor nav */}
          <nav className="space-y-1 md:sticky md:top-4 md:self-start">
            <a
              href="#section-global"
              className="flex w-full items-center gap-2 rounded-md border border-accent/40 bg-card px-3 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent/10"
            >
              <Globe className="h-4 w-4 text-accent" /> Global rules
            </a>
            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stages</div>
            {SECTIONS.filter((s) => !s.global).map((s) => (
              <a
                key={s.id}
                href={`#section-${s.id}`}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </nav>

          {/* Content */}
          <div className="space-y-5">
            {/* Scope context bar */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="h-4 w-4" /> Scope
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <ScopeSelect label="Deal type" value={ctx.dealType} options={SCENARIO_OPTIONS} onChange={(v) => setCtx({ ...ctx, dealType: v })} />
                <ScopeSelect label="Scenario" value={ctx.scenario} options={SCENARIO_OPTIONS} onChange={(v) => setCtx({ ...ctx, scenario: v })} />
                <ScopeSelect label="Market" value={ctx.market} options={MARKET_OPTIONS} onChange={(v) => setCtx({ ...ctx, market: v })} />
              </div>
              <div className={`mt-3 rounded-md px-3 py-2 text-xs ${isBase ? "bg-secondary/50 text-muted-foreground" : "bg-amber-50 text-amber-800"}`}>
                {isBase
                  ? "Editing the global base rules — these apply to all deals unless a scoped override refines them."
                  : "Editing a scoped override. Only the fields you tick are changed; everything else inherits the global value."}
              </div>
            </div>

            {/* All sections rendered together */}
            {SECTIONS.map((section) => {
              const fields = SECTION_FIELDS[section.id] ?? [];
              return (
                <section key={section.id} id={`section-${section.id}`} className="scroll-mt-4 rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border px-5 py-4">
                    <h2 className="text-base font-semibold text-foreground">{section.label.replace(/^\d+ · /, "")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{section.note}</p>
                  </div>

                  {!section.global && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border bg-secondary/30 px-5 py-2.5 text-xs">
                      <span className="font-semibold uppercase tracking-wider text-muted-foreground">Inherited from Global</span>
                      <span>Scope: <span className="font-medium text-foreground">{store.base.market.commodity} · {store.base.market.region} · {store.base.market.hub}</span></span>
                      <span>Financial gate: <span className="font-medium text-foreground">{store.base.financialGate.enabled ? `≥ ${eur(store.base.financialGate.minGrossMarginEur)}` : "off"}</span></span>
                      <span>Notional alert: <span className="font-medium text-foreground">{eur(store.base.compliance.singleDealNotionalAlertEur)}</span></span>
                    </div>
                  )}

                  <div className="px-5 py-3">
                    {fields.length > 0 ? (
                      isBase || section.global ? (
                        <div className="divide-y divide-border">{fields.map(renderField)}</div>
                      ) : (
                        <div>{fields.map(renderField)}</div>
                      )
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">This stage has no rules of its own — it operates on the inherited global rules shown above.</p>
                    )}
                  </div>
                </section>
              );
            })}

            {/* Active overrides */}
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active overrides ({store.overrides.length})</h3>
              {store.overrides.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">None. Pick a scope above and tick "Override here" on any field to create one.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {store.overrides.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {[o.scope.dealType, o.scope.scenario, o.scope.market].filter(Boolean).map((c) => (
                          <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">{c}</span>
                        ))}
                        <span className="text-xs text-muted-foreground">· {Object.keys(o.values).length} field(s) overridden</span>
                      </span>
                      <button onClick={() => removeOverride(o.id)} className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function ScopeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
