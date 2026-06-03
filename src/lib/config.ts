// Business-rule configuration with a global -> stage -> scoped-override engine.
// Persisted to localStorage. No DB.
import { useEffect, useState, useCallback } from "react";

export type Commodity = "Gas" | "Power";
export type Region = "Northwest Europe" | "Southern Europe" | "Central & Eastern Europe";
export type Hub = "TTF" | "THE" | "PEG" | "PSV";

// The flat rule values — the SAME shape every stage already reads (cfg.prospects.fitGreen, etc.).
export type AppConfig = {
  market: { commodity: Commodity; region: Region; hub: Hub };
  scenarioWeights: {
    strategicFit: number;
    profitabilityPotential: number;
    portfolioSynergy: number;
    dealComplexity: number;
    dataAvailability: number;
  };
  prospects: {
    minVolumeGWh: number;
    fitGreen: number;
    fitAmber: number;
    weights: { swing: number; credit: number; volume: number; strategic: number };
  };
  compliance: { singleDealNotionalAlertEur: number };
  financialGate: { enabled: boolean; minGrossMarginEur: number };
  guardrails: { liquidCurveYears: number; minVolumeFlexPct: number };
};

export const DEFAULT_CONFIG: AppConfig = {
  market: { commodity: "Gas", region: "Northwest Europe", hub: "TTF" },
  scenarioWeights: { strategicFit: 25, profitabilityPotential: 30, portfolioSynergy: 20, dealComplexity: 10, dataAvailability: 15 },
  prospects: { minVolumeGWh: 800, fitGreen: 80, fitAmber: 65, weights: { swing: 40, credit: 25, volume: 20, strategic: 15 } },
  compliance: { singleDealNotionalAlertEur: 5_000_000 },
  financialGate: { enabled: true, minGrossMarginEur: 750_000 },
  guardrails: { liquidCurveYears: 3, minVolumeFlexPct: 10 },
};

// ---- Override engine ----------------------------------------------------
// A scope qualifies an override by one or more dimensions. Empty = applies to all.
export type Scope = { dealType?: string; scenario?: string; market?: string };
// An override sets specific rule fields (by dotted path) for a given scope.
export type Override = { id: string; scope: Scope; values: Record<string, number | string | boolean> };
export type ConfigStore = { base: AppConfig; overrides: Override[] };

export const SCENARIO_OPTIONS = [
  "Gas Supply + Storage",
  "Standalone Storage Capacity",
  "Flexible Power Asset",
  "Corporate PPA",
  "Gas Producer / LNG",
];
export const MARKET_OPTIONS = ["Northwest Europe", "Southern Europe", "Central & Eastern Europe"];
// The scenario this prototype is built around (used to resolve runtime context).
export const ACTIVE_SCENARIO = "Gas Supply + Storage";

const STORAGE_KEY = "see.origination.config.v2";
const LEGACY_KEY = "see.origination.config.v1";
const EVENT = "see-config-changed";

function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function deepSet(obj: any, path: string, val: any) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}

export function scopeMatches(scope: Scope, ctx: Scope): boolean {
  return (
    (!scope.dealType || scope.dealType === ctx.dealType) &&
    (!scope.scenario || scope.scenario === ctx.scenario) &&
    (!scope.market || scope.market === ctx.market)
  );
}
export function specificity(scope: Scope): number {
  return (scope.dealType ? 1 : 0) + (scope.scenario ? 1 : 0) + (scope.market ? 1 : 0);
}

// Resolve effective rules for a context: base, then matching overrides (least to most specific).
export function resolveConfig(store: ConfigStore, ctx: Scope): AppConfig {
  const v: AppConfig = structuredClone(store.base);
  const matches = store.overrides
    .filter((o) => scopeMatches(o.scope, ctx))
    .sort((a, b) => specificity(a.scope) - specificity(b.scope));
  for (const o of matches) {
    for (const [path, val] of Object.entries(o.values)) deepSet(v, path, val);
  }
  return v;
}

export function runtimeContext(base: AppConfig): Scope {
  return { dealType: ACTIVE_SCENARIO, scenario: ACTIVE_SCENARIO, market: base.market.region };
}

function mergeBase(parsed: any): AppConfig {
  const d = DEFAULT_CONFIG;
  return {
    ...d,
    ...parsed,
    market: { ...d.market, ...(parsed?.market ?? {}) },
    scenarioWeights: { ...d.scenarioWeights, ...(parsed?.scenarioWeights ?? {}) },
    prospects: {
      ...d.prospects,
      ...(parsed?.prospects ?? {}),
      weights: { ...d.prospects.weights, ...(parsed?.prospects?.weights ?? {}) },
    },
    compliance: { ...d.compliance, ...(parsed?.compliance ?? {}) },
    financialGate: { ...d.financialGate, ...(parsed?.financialGate ?? {}) },
    guardrails: { ...d.guardrails, ...(parsed?.guardrails ?? {}) },
  };
}

export function readStore(): ConfigStore {
  if (typeof window === "undefined") return { base: DEFAULT_CONFIG, overrides: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { base: mergeBase(parsed.base), overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [] };
    }
    // migrate a legacy flat config into the base layer
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) return { base: mergeBase(JSON.parse(legacy)), overrides: [] };
  } catch {
    /* ignore */
  }
  return { base: DEFAULT_CONFIG, overrides: [] };
}

export function writeStore(store: ConfigStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(EVENT));
}

// ---- Consumer APIs (resolved by current context) ------------------------
export function readConfig(): AppConfig {
  const store = readStore();
  return resolveConfig(store, runtimeContext(store.base));
}

export function writeConfig(base: AppConfig) {
  const store = readStore();
  writeStore({ ...store, base });
}

// Read-only-for-resolution hook: returns effective rules for the current context.
export function useConfig(): [AppConfig, (cfg: AppConfig) => void] {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    setCfg(readConfig());
    const handler = () => setCfg(readConfig());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = useCallback((next: AppConfig) => {
    writeConfig(next);
    setCfg(readConfig());
  }, []);
  return [cfg, update];
}

// Raw base hook — for the scope bar and any editor that must touch the global layer directly.
export function useBaseConfig(): [AppConfig, (cfg: AppConfig) => void] {
  const [base, setBase] = useState<AppConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    setBase(readStore().base);
    const handler = () => setBase(readStore().base);
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = useCallback((next: AppConfig) => {
    const store = readStore();
    writeStore({ ...store, base: next });
    setBase(next);
  }, []);
  return [base, update];
}

// Full store hook — for the Settings page (base + overrides).
export function useStore(): [ConfigStore, (s: ConfigStore) => void] {
  const [store, setStore] = useState<ConfigStore>({ base: DEFAULT_CONFIG, overrides: [] });
  useEffect(() => {
    setStore(readStore());
    const handler = () => setStore(readStore());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const update = useCallback((s: ConfigStore) => {
    writeStore(s);
    setStore(s);
  }, []);
  return [store, update];
}

export { deepGet };

export function scopeSubtitle(cfg: AppConfig): string {
  const region =
    cfg.market.region === "Northwest Europe" ? "NW Europe" : cfg.market.region === "Southern Europe" ? "S Europe" : "CEE";
  return `${cfg.market.commodity} · ${region} · ${cfg.market.hub}`;
}
