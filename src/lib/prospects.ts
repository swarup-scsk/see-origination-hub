// Shared prospect dataset — used by Stage 2 (prospecting) and Stage 3 (qualification).
// Raw attributes only; scores/insights are produced by the n8n + Gemma workflow.
// Now also carries the relationship + provenance context an originator relies on.

export type Prospect = {
  name: string;
  country: string;
  sector: string;
  volumeGWh: number;
  swing: number; // seasonal swing need, 0-100
  credit: number; // creditworthiness, 0-100
  strategic: number; // strategic fit, 0-100
  // Relationship layer (the origination moat)
  primaryContact: string; // name + role
  relationship: string; // strength / mandate status
  lastContact: string; // human-readable recency
  // Provenance — what the attribute estimates are based on
  dataSources: string[];
};

export const PROSPECTS: Prospect[] = [
  {
    name: "Westland Greenhouse Energy Co-op", country: "Netherlands", sector: "Horticulture / greenhouse heating",
    volumeGWh: 1250, swing: 95, credit: 80, strategic: 90,
    primaryContact: "Marieke de Vries — Energy Procurement Lead",
    relationship: "Warm — met at Flame; soft mandate for winter supply",
    lastContact: "3 weeks ago",
    dataSources: ["GIE AGSI+ storage", "Co-op annual report FY25", "Industry press (greenhouse heating demand)"],
  },
  {
    name: "Stadswarmte Rotterdam", country: "Netherlands", sector: "District heating",
    volumeGWh: 980, swing: 88, credit: 85, strategic: 82,
    primaryContact: "Johan Bakker — CFO",
    relationship: "Established — prior storage deal 2024",
    lastContact: "Last week",
    dataSources: ["Municipal accounts", "ENTSOG flows", "Tender notice (heat supply)"],
  },
  {
    name: "Benelux Power & Heat NV", country: "Belgium", sector: "CHP / cogeneration",
    volumeGWh: 1600, swing: 78, credit: 68, strategic: 80,
    primaryContact: "Sophie Laurent — Head of Trading",
    relationship: "Developing — exploratory calls only",
    lastContact: "2 months ago",
    dataSources: ["Company filings", "Credit agency summary", "Plant register"],
  },
  {
    name: "NorthSea Industrial Gas BV", country: "Netherlands", sector: "Industrial process gas",
    volumeGWh: 2100, swing: 45, credit: 82, strategic: 65,
    primaryContact: "Tom Jansen — Procurement Manager",
    relationship: "Transactional — price-led buyer",
    lastContact: "Last month",
    dataSources: ["Annual report", "ENTSOG flows", "Sector demand benchmarks"],
  },
  {
    name: "Limburg Regional Supplier", country: "Netherlands", sector: "Regional LDC",
    volumeGWh: 540, swing: 85, credit: 70, strategic: 60,
    primaryContact: "Anika Peters — Managing Director",
    relationship: "Warm — long-standing personal relationship",
    lastContact: "2 weeks ago",
    dataSources: ["Regulatory filings", "GIE AGSI+ storage", "Local press"],
  },
  {
    name: "Antwerp Chemicals Cluster", country: "Belgium", sector: "Petrochemical cluster",
    volumeGWh: 3400, swing: 25, credit: 88, strategic: 55,
    primaryContact: "Dirk Mertens — VP Energy",
    relationship: "Cold — no prior contact",
    lastContact: "Never",
    dataSources: ["Group accounts", "Cluster demand study", "Credit agency summary"],
  },
];

export function findProspect(name: string): Prospect | undefined {
  return PROSPECTS.find((p) => p.name === name);
}
