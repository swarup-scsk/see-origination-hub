// Shared prospect dataset — used by Stage 2 (prospecting) and Stage 3 (qualification).
// Raw attributes only; scores/insights are produced by the n8n + Gemma workflow.

export type Prospect = {
  name: string;
  country: string;
  sector: string;
  volumeGWh: number;
  swing: number; // seasonal swing need, 0-100
  credit: number; // creditworthiness, 0-100
  strategic: number; // strategic fit, 0-100
};

export const PROSPECTS: Prospect[] = [
  { name: "Westland Greenhouse Energy Co-op", country: "Netherlands", sector: "Horticulture / greenhouse heating", volumeGWh: 1250, swing: 95, credit: 80, strategic: 90 },
  { name: "Stadswarmte Rotterdam", country: "Netherlands", sector: "District heating", volumeGWh: 980, swing: 88, credit: 85, strategic: 82 },
  { name: "Benelux Power & Heat NV", country: "Belgium", sector: "CHP / cogeneration", volumeGWh: 1600, swing: 78, credit: 68, strategic: 80 },
  { name: "NorthSea Industrial Gas BV", country: "Netherlands", sector: "Industrial process gas", volumeGWh: 2100, swing: 45, credit: 82, strategic: 65 },
  { name: "Limburg Regional Supplier", country: "Netherlands", sector: "Regional LDC", volumeGWh: 540, swing: 85, credit: 70, strategic: 60 },
  { name: "Antwerp Chemicals Cluster", country: "Belgium", sector: "Petrochemical cluster", volumeGWh: 3400, swing: 25, credit: 88, strategic: 55 },
];

export function findProspect(name: string): Prospect | undefined {
  return PROSPECTS.find((p) => p.name === name);
}
