// Business-rule configuration, persisted to localStorage. No DB.
import { useEffect, useState, useCallback } from "react";

export type Commodity = "Gas" | "Power";
export type Region =
  | "Northwest Europe"
  | "Southern Europe"
  | "Central & Eastern Europe";
export type Hub = "TTF" | "THE" | "PEG" | "PSV";

export type AppConfig = {
  market: {
    commodity: Commodity;
    region: Region;
    hub: Hub;
  };
  scenarioWeights: {
    strategicFit: number;
    dealComplexity: number;
    dataAvailability: number;
    demoClarity: number;
    replicability: number;
  };
  prospects: {
    minVolumeGWh: number;
    fitGreen: number;
    fitAmber: number;
    weights: {
      swing: number;
      credit: number;
      volume: number;
      strategic: number;
    };
  };
  compliance: {
    singleDealNotionalAlertEur: number;
  };
};

export const DEFAULT_CONFIG: AppConfig = {
  market: {
    commodity: "Gas",
    region: "Northwest Europe",
    hub: "TTF",
  },
  scenarioWeights: {
    strategicFit: 20,
    dealComplexity: 20,
    dataAvailability: 20,
    demoClarity: 20,
    replicability: 20,
  },
  prospects: {
    minVolumeGWh: 800,
    fitGreen: 80,
    fitAmber: 65,
    weights: { swing: 40, credit: 25, volume: 20, strategic: 15 },
  },
  compliance: {
    singleDealNotionalAlertEur: 5_000_000,
  },
};

const STORAGE_KEY = "see.origination.config.v1";
const EVENT = "see-config-changed";

export function readConfig(): AppConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    // shallow merge defaults so new fields don't break older saves
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      market: { ...DEFAULT_CONFIG.market, ...(parsed.market ?? {}) },
      scenarioWeights: {
        ...DEFAULT_CONFIG.scenarioWeights,
        ...(parsed.scenarioWeights ?? {}),
      },
      prospects: {
        ...DEFAULT_CONFIG.prospects,
        ...(parsed.prospects ?? {}),
        weights: {
          ...DEFAULT_CONFIG.prospects.weights,
          ...(parsed.prospects?.weights ?? {}),
        },
      },
      compliance: {
        ...DEFAULT_CONFIG.compliance,
        ...(parsed.compliance ?? {}),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function writeConfig(cfg: AppConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent(EVENT));
}

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
    setCfg(next);
  }, []);

  return [cfg, update];
}

export function scopeSubtitle(cfg: AppConfig): string {
  const region =
    cfg.market.region === "Northwest Europe"
      ? "NW Europe"
      : cfg.market.region === "Southern Europe"
        ? "S Europe"
        : "CEE";
  return `${cfg.market.commodity} · ${region} · ${cfg.market.hub}`;
}
