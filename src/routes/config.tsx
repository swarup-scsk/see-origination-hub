import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  DEFAULT_CONFIG,
  useConfig,
  type AppConfig,
  type Commodity,
  type Hub,
  type Region,
} from "@/lib/config";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configuration — SEE Origination Hub" },
      {
        name: "description",
        content:
          "Business rules that drive selections, scoring and thresholds across all origination stages.",
      },
    ],
  }),
  component: ConfigPage,
});

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40";
const numberCls = selectCls;

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function ConfigPage() {
  const [saved, setSaved] = useConfig();
  const [draft, setDraft] = useState<AppConfig>(saved);

  // re-sync draft when storage changes (e.g. scope changed on Stage 1)
  // intentionally simple — user opens config fresh each time
  if (
    draft !== saved &&
    JSON.stringify(draft) === JSON.stringify(DEFAULT_CONFIG) &&
    saved !== DEFAULT_CONFIG
  ) {
    // no-op
  }

  const save = () => {
    setSaved(draft);
    toast.success("Configuration saved", {
      description: "Business rules updated across all stages.",
    });
  };

  const reset = () => {
    setDraft(DEFAULT_CONFIG);
    setSaved(DEFAULT_CONFIG);
    toast("Defaults restored");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Configuration" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Configuration — Business Rules
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These settings drive the selections, scoring and thresholds across
            all stages.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Market & Scope">
            <Field label="Commodity">
              <select
                className={selectCls}
                value={draft.market.commodity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    market: {
                      ...draft.market,
                      commodity: e.target.value as Commodity,
                    },
                  })
                }
              >
                <option>Gas</option>
                <option>Power</option>
              </select>
            </Field>
            <Field label="Region">
              <select
                className={selectCls}
                value={draft.market.region}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    market: {
                      ...draft.market,
                      region: e.target.value as Region,
                    },
                  })
                }
              >
                <option>Northwest Europe</option>
                <option>Southern Europe</option>
                <option>Central &amp; Eastern Europe</option>
              </select>
            </Field>
            <Field label="Price hub">
              <select
                className={selectCls}
                value={draft.market.hub}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    market: { ...draft.market, hub: e.target.value as Hub },
                  })
                }
              >
                <option>TTF</option>
                <option>THE</option>
                <option>PEG</option>
                <option>PSV</option>
              </select>
            </Field>
          </Card>

          <Card
            title="Scenario scoring weights"
            description="Used to rank scenarios on Stage 1."
          >
            {(
              [
                ["strategicFit", "Strategic fit"],
                ["dealComplexity", "Deal complexity"],
                ["dataAvailability", "Data availability"],
                ["demoClarity", "Demo clarity"],
                ["replicability", "Replicability"],
              ] as const
            ).map(([key, label]) => (
              <SliderRow
                key={key}
                label={label}
                value={draft.scenarioWeights[key]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    scenarioWeights: { ...draft.scenarioWeights, [key]: v },
                  })
                }
              />
            ))}
          </Card>

          <Card
            title="Prospect scoring rules"
            description="Used on Stage 2 — Prospecting."
          >
            <Field
              label="Target minimum annual volume"
              hint="GWh / year"
            >
              <input
                type="number"
                min={0}
                step={50}
                className={numberCls}
                value={draft.prospects.minVolumeGWh}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    prospects: {
                      ...draft.prospects,
                      minVolumeGWh: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Strong (green) ≥" hint="Fit score">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={numberCls}
                  value={draft.prospects.fitGreen}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      prospects: {
                        ...draft.prospects,
                        fitGreen: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Consider (amber) ≥" hint="Fit score">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={numberCls}
                  value={draft.prospects.fitAmber}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      prospects: {
                        ...draft.prospects,
                        fitAmber: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            </div>
            <div className="border-t border-border pt-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Weights
              </div>
              {(
                [
                  ["swing", "Swing need"],
                  ["credit", "Creditworthiness"],
                  ["volume", "Volume"],
                  ["strategic", "Strategic fit"],
                ] as const
              ).map(([key, label]) => (
                <SliderRow
                  key={key}
                  label={label}
                  value={draft.prospects.weights[key]}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      prospects: {
                        ...draft.prospects,
                        weights: { ...draft.prospects.weights, [key]: v },
                      },
                    })
                  }
                />
              ))}
            </div>
          </Card>

          <Card
            title="Compliance thresholds"
            description="Placeholder — used in later stages."
          >
            <Field
              label="Single-deal notional alert threshold"
              hint="€"
            >
              <input
                type="number"
                min={0}
                step={100000}
                className={numberCls}
                value={draft.compliance.singleDealNotionalAlertEur}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    compliance: {
                      ...draft.compliance,
                      singleDealNotionalAlertEur: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to defaults
          </button>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </main>
    </div>
  );
}
