import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Pencil, X, Info } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  useConfig,
  type Commodity,
  type Hub,
  type Region,
} from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SEE Origination Hub — Scenario Selection" },
      {
        name: "description",
        content:
          "Evaluate and select an origination deal scenario for SCEE energy trading.",
      },
    ],
  }),
  component: Index,
});

type Scenario = {
  id: string;
  title: string;
  description: string;
  ratings: [number, number, number, number, number];
  tag: "SELECTED" | "Alternative";
};

const CRITERIA = [
  "Strategic fit",
  "Profitability potential",
  "Portfolio synergy",
  "Deal complexity",
  "Data availability",
] as const;

const SCENARIOS: Scenario[] = [
  {
    id: "gas-supply-storage",
    title: "Gas Supply + Storage",
    description:
      "Structured gas supply with seasonal swing, backed by storage and transport capacity.",
    ratings: [5, 5, 5, 4, 5],
    tag: "SELECTED",
  },
  {
    id: "standalone-storage",
    title: "Standalone Storage Capacity",
    description: "Lease and optimise storage as a summer–winter spread option.",
    ratings: [4, 4, 5, 4, 4],
    tag: "Alternative",
  },
  {
    id: "flexible-power",
    title: "Flexible Power Asset",
    description: "Route-to-market and revenue stacking for a battery or peaker.",
    ratings: [5, 4, 3, 4, 5],
    tag: "Alternative",
  },
  {
    id: "corporate-ppa",
    title: "Corporate PPA",
    description: "Renewable offtake sleeved to a corporate buyer.",
    ratings: [3, 3, 2, 3, 4],
    tag: "Alternative",
  },
  {
    id: "gas-producer-lng",
    title: "Gas Producer / LNG",
    description: "Cargo and regas into the supply chain.",
    ratings: [3, 4, 3, 4, 3],
    tag: "Alternative",
  },
];

function RatingBar({ value }: { value: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-4 rounded-sm ${
            i <= value ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  const selected = s.tag === "SELECTED";
  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-card p-6 transition-shadow ${
        selected
          ? "border-accent shadow-lg ring-2 ring-accent/30"
          : "border-border shadow-sm hover:shadow-md"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-tight text-foreground">
          {s.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${
            selected
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {selected && <Check className="mr-1 inline h-3 w-3" />}
          {s.tag}
        </span>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        {s.description}
      </p>

      <dl className="mb-6 space-y-2">
        {CRITERIA.map((c, i) => (
          <div key={c} className="flex items-center justify-between text-xs">
            <dt className="text-muted-foreground">{c}</dt>
            <dd className="flex items-center gap-2">
              <RatingBar value={s.ratings[i]} />
              <span className="w-4 text-right font-medium text-foreground">
                {s.ratings[i]}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto">
        {selected ? (
          <Link
            to="/stage-2"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Begin this deal →
          </Link>
        ) : (
          <button
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground"
          >
            Not selected
          </button>
        )}
      </div>
    </div>
  );
}

const HUBS: { code: string; name: string }[] = [
  { code: "TTF", name: "Title Transfer Facility (Netherlands)" },
  { code: "THE", name: "Trading Hub Europe (Germany)" },
  { code: "PEG", name: "Point d'Échange de Gaz (France)" },
  { code: "PSV", name: "Punto di Scambio Virtuale (Italy)" },
];

function ScopeBar() {
  const [cfg, setCfg] = useConfig();
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState(false);
  const hubName = HUBS.find((h) => h.code === cfg.market.hub)?.name ?? "";

  if (!editing) {
    return (
      <div className="mb-8 rounded-lg border border-border bg-card px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Market &amp; scope
              <button
                onClick={() => setInfo((v) => !v)}
                aria-label="About market & scope"
                title="About market & scope"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </span>
            <span>
              <span className="text-muted-foreground">Commodity:</span>{" "}
              <span className="font-semibold text-foreground">{cfg.market.commodity}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Region:</span>{" "}
              <span className="font-semibold text-foreground">{cfg.market.region}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Hub:</span>{" "}
              <span className="font-semibold text-foreground">{cfg.market.hub}</span>
              <span className="text-muted-foreground"> — {hubName}</span>
            </span>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
          <Pencil className="h-3 w-3" />
          Change
        </button>
        </div>

        {info && (
          <div className="mt-3 rounded-md border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-2 text-foreground">
              <span className="font-semibold">Market &amp; scope</span> sets the commodity, region and
              pricing hub this origination cycle operates in. It flows through every stage — prospecting,
              structuring, pricing and risk all read it.
            </p>
            <p className="font-semibold text-foreground">European gas hubs</p>
            <ul className="mt-1 space-y-0.5">
              {HUBS.map((h) => (
                <li key={h.code}>
                  <span className="font-semibold text-foreground">{h.code}</span> — {h.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const selectCls =
    "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-accent/40 bg-card px-5 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Commodity</span>
          <select
            className={selectCls}
            value={cfg.market.commodity}
            onChange={(e) =>
              setCfg({
                ...cfg,
                market: {
                  ...cfg.market,
                  commodity: e.target.value as Commodity,
                },
              })
            }
          >
            <option>Gas</option>
            <option>Power</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Region</span>
          <select
            className={selectCls}
            value={cfg.market.region}
            onChange={(e) =>
              setCfg({
                ...cfg,
                market: { ...cfg.market, region: e.target.value as Region },
              })
            }
          >
            <option>Northwest Europe</option>
            <option>Southern Europe</option>
            <option>Central &amp; Eastern Europe</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Hub</span>
          <select
            className={selectCls}
            value={cfg.market.hub}
            onChange={(e) =>
              setCfg({
                ...cfg,
                market: { ...cfg.market, hub: e.target.value as Hub },
              })
            }
          >
            {HUBS.map((h) => (
              <option key={h.code} value={h.code}>
                {h.code} — {h.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        onClick={() => setEditing(false)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <X className="h-3 w-3" />
        Done
      </button>
    </div>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 1 of 9" current={1} />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <ScopeBar />

        <div className="mb-10 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Choose an origination scenario
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            We evaluated five candidate deal types against five criteria and
            selected the strongest fit for SCEE.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <ScenarioCard key={s.id} s={s} />
          ))}
        </div>

        <div className="mt-10 rounded-lg border-l-4 border-accent bg-secondary/60 px-5 py-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Selected:</span> Gas Supply +
            Storage — highest combined strategic fit, profitability potential and portfolio synergy.
          </p>
        </div>
      </main>
    </div>
  );
}
