import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";

const WEBHOOK_URL = "http://localhost:5678/webhook/qualify";

export const Route = createFileRoute("/stage-3")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 3 — Qualification | SEE Origination Hub" },
      { name: "description", content: "Qualify the selected counterparty." },
    ],
  }),
  component: Stage3,
});

type Qualification = {
  recommendation: "Proceed" | "Hold" | "Decline";
  rationale: string;
  brief: string;
  fit: number;
  indicativeSwingGWh: number;
  targetMet: boolean;
};

function Attribute({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-muted-foreground/50";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function recBadge(rec: Qualification["recommendation"]) {
  if (rec === "Proceed") return "bg-emerald-100 text-emerald-800";
  if (rec === "Hold") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

function Stage3() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [qual, setQual] = useState<Qualification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runQualify = async () => {
    if (!prospect) return;
    const fullConfig = readConfig();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: fullConfig, prospect }),
      });
      if (!res.ok) throw new Error(`Workflow returned HTTP ${res.status}`);
      const data = await res.json();
      setQual(data as Qualification);
      setStatus("done");
    } catch (e) {
      // Fallback: compute the deterministic parts locally, leave the brief as a note.
      const minVol = fullConfig.prospects.minVolumeGWh;
      const fit =
        fullConfig.prospects.fitGreen <= prospect.swing ? prospect.swing : prospect.swing;
      const targetMet = prospect.volumeGWh >= minVol;
      const rec: Qualification["recommendation"] = !targetMet
        ? "Hold"
        : prospect.swing >= 80
          ? "Proceed"
          : "Hold";
      setQual({
        recommendation: rec,
        rationale: "Computed locally — AI brief unavailable (workflow not reachable).",
        brief: "AI qualification brief pending.",
        fit,
        indicativeSwingGWh: Math.round(prospect.volumeGWh * 0.2),
        targetMet,
      });
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 3 of 9" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Qualification
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Qualify the counterparty
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Assess demand profile, indicative deal size and strategic fit, then decide
          whether to take this opportunity forward to structuring.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back to prospecting and choose one.
          </div>
        )}

        {prospect && (
          <div className="mt-8 grid gap-6 md:grid-cols-5">
            {/* Counterparty card */}
            <section className="md:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground">{prospect.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {prospect.sector} · {prospect.country}
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Annual volume</dt>
                  <dd className="font-semibold text-foreground">
                    {prospect.volumeGWh.toLocaleString()} GWh/yr
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Price hub</dt>
                  <dd className="font-semibold text-foreground">{cfg.market.hub}</dd>
                </div>
              </dl>
              <div className="mt-5 space-y-3">
                <Attribute label="Seasonal swing need" value={prospect.swing} />
                <Attribute label="Creditworthiness" value={prospect.credit} />
                <Attribute label="Strategic fit" value={prospect.strategic} />
              </div>
            </section>

            {/* Qualification panel */}
            <section className="md:col-span-3 rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Qualification assessment
                </h2>
                <button
                  onClick={runQualify}
                  disabled={status === "loading"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Sparkles className="h-4 w-4" />
                  {qual ? "Re-assess" : "Generate qualification brief"}
                </button>
              </div>

              {status === "loading" && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Assessing demand fit, indicative sizing and risks…
                </p>
              )}

              {status === "idle" && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Click “Generate qualification brief” to run the AI assessment.
                </p>
              )}

              {status === "done" && qual && (
                <div className="mt-5 space-y-5">
                  {error && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Workflow unavailable — showing computed values only. ({error})
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${recBadge(qual.recommendation)}`}>
                      {qual.recommendation}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Indicative swing volume:{" "}
                      <span className="font-semibold text-foreground">
                        ~{qual.indicativeSwingGWh.toLocaleString()} GWh
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {qual.targetMet ? "Meets volume target" : "Below volume target"}
                    </span>
                  </div>

                  <div className="rounded-md bg-secondary/50 p-4">
                    <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                      <Sparkles className="h-3 w-3" /> AI assessment
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{qual.brief}</p>
                    {qual.rationale && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        <span className="font-semibold">Recommendation basis:</span> {qual.rationale}
                      </p>
                    )}
                  </div>

                  {/* Go / No-go */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      to="/stage-4"
                      search={{ company: prospect.name }}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Proceed to structuring →
                    </Link>
                    <Link
                      to="/stage-2"
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <PauseCircle className="h-4 w-4" />
                      Park / pick another
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <div className="mt-10">
          <Link to="/stage-2" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to prospecting
          </Link>
        </div>
      </main>
    </div>
  );
}
