// Shared deterministic economics — used by Deal Analysis pricing, the Financial Gate,
// and the structuring guardrails. Numbers live here; the LLM only narrates them.

export type Assumptions = { spread: number; swingPct: number; extrinsicPct: number; supplyMargin: number };
export type Line = { label: string; value: string };

export const HUB_SPREAD: Record<string, number> = { TTF: 4.2, THE: 4.5, PEG: 3.8, PSV: 5.0 };

export function defaultAssumptions(hub: string): Assumptions {
  return { spread: HUB_SPREAD[hub] ?? 4.2, swingPct: 20, extrinsicPct: 25, supplyMargin: 0.3 };
}

export function computePricing(volumeGWh: number, a: Assumptions) {
  const swing = Math.round(volumeGWh * (a.swingPct / 100));
  const base = volumeGWh - swing;
  const intrinsic = swing * 1000 * a.spread;
  const extrinsic = intrinsic * (a.extrinsicPct / 100);
  const supply = base * 1000 * a.supplyMargin;
  const gross = intrinsic + extrinsic + supply;
  return { swing, base, intrinsic, extrinsic, supply, gross };
}

export const eur = (n: number) => "€" + Math.round(n).toLocaleString();

export function pricingLines(hub: string, a: Assumptions, pv: ReturnType<typeof computePricing>): Line[] {
  return [
    { label: `Seasonal spread (${hub} S/W)`, value: `€${a.spread.toFixed(2)}/MWh` },
    { label: `Storage swing volume (${a.swingPct}%)`, value: `${pv.swing.toLocaleString()} GWh` },
    { label: "Intrinsic storage value", value: eur(pv.intrinsic) },
    { label: `Extrinsic (optionality, ${a.extrinsicPct}%)`, value: eur(pv.extrinsic) },
    { label: `Supply baseload margin (€${a.supplyMargin.toFixed(2)}/MWh)`, value: eur(pv.supply) },
    { label: "Indicative gross margin", value: eur(pv.gross) },
  ];
}

// Indicative gross margin from default (hub) assumptions — used to screen early, before full pricing.
export function indicativeGrossMargin(volumeGWh: number, hub: string): number {
  return computePricing(volumeGWh, defaultAssumptions(hub)).gross;
}

// Financial Gate: the one HARD reject. Below the hurdle, a deal is removed from the shortlist.
export function financialGate(
  volumeGWh: number,
  hub: string,
  gate: { enabled: boolean; minGrossMarginEur: number },
): { pass: boolean; margin: number; hurdle: number; enabled: boolean } {
  const margin = indicativeGrossMargin(volumeGWh, hub);
  const pass = !gate.enabled || margin >= gate.minGrossMarginEur;
  return { pass, margin, hurdle: gate.minGrossMarginEur, enabled: gate.enabled };
}
