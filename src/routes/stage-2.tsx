import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { PROSPECTS } from "@/lib/prospects";

export const Route = createFileRoute("/stage-2")({
  head: () => ({
    meta: [
      { title: "Stage 2 — Prospecting | SEE Origination Hub" },
      {
        name: "description",
        content:
          "AI-assisted prospecting for Gas Supply + Storage counterparties.",
      },
    ],
  }),
  component: Stage2,
});

// n8n workflow endpoint (local). The app POSTs { config, prospects } here;
// n8n scores deterministically and Gemma writes each insight.
const WEBHOOK_URL = "http://localhost:5678/webhook/prospect-scan";

// Raw prospect attributes come from the shared dataset; the workflow computes scores + insights.
const INPUT_PROSPECTS = PROSPECTS;

// Shape returned by the workflow.
type Result = {
  rank: number;
  name: string;
  country: string;
  volume: string;
  volumeGWh?: number;
  fit: number | null;
  band: "green" | "amber" | "grey";
  belowTarget: boolean;
  insight: string;
};

function bandBarColor(band: Result["band"]) {
  if (band === "green") return "bg-emerald-500";
  if (band === "amber") return "bg-amber-500";
  return "bg-muted-foreground/50";
}

function bandTextColor(band: Result["band"]) {
  if (band === "green") return "text-emerald-700";
  if (band === "amber") return "text-amber-700";
  return "text-muted-foreground";
}

function Stage2() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cfg] = useConfig();

  const runScan = async () => {
    const fullConfig = readConfig();
    // eslint-disable-next-line no-console
    console.log("[SEE Origination Hub] Workflow config payload:", fullConfig);
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: fullConfig, prospects: INPUT_PROSPECTS }),
      });
      if (!res.ok) throw new Error(`Workflow returned HTTP ${res.status}`);
      const data = await res.json();
      const list: Result[] = Array.isArray(data?.prospects) ? data.prospects : [];
      if (list.length === 0) throw new Error("Workflow returned no prospects");
      setResults(list);
      setStatus("done");
    } catch (e) {
      // Graceful fallback: show prospects with no score and a neutral note.
      const minVol = fullConfig.prospects.minVolumeGWh;
      const fallback: Result[] = INPUT_PROSPECTS.map((p, i) => ({
        rank: i + 1,
        name: p.name,
        country: p.country,
        volume: `${p.volumeGWh.toLocaleString()} GWh/yr`,
        volumeGWh: p.volumeGWh,
        fit: null,
        band: "grey",
        belowTarget: p.volumeGWh < minVol,
        insight: "AI insight pending — workflow not reachable.",
      }));
      setResults(fallback);
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 2 of 9" />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            AI-assisted
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI-Assisted Prospecting
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Scanning the market for counterparties whose demand profile fits a
          supply + storage structure.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          We are originating a {cfg.market.commodity} Supply + Storage deal in{" "}
          {cfg.market.region}, looking for counterparties with seasonal winter
          swing that our supply + storage portfolio can serve.
        </p>

        {/* Active rules summary */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Active rules
          </span>
          <span>
            Target volume:{" "}
            <span className="font-semibold text-foreground">
              ≥ {cfg.prospects.minVolumeGWh.toLocaleString()} GWh/yr
            </span>
          </span>
          <span>
            Fit thresholds:{" "}
            <span className="font-semibold text-emerald-700">
              ≥ {cfg.prospects.fitGreen}
            </span>{" "}
            ·{" "}
            <span className="font-semibold text-amber-700">
              ≥ {cfg.prospects.fitAmber}
            </span>
          </span>
        </div>

        {/* Market signals */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Market signals
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "EU gas storage", value: "61% full", caption: "GIE AGSI+, seasonal build underway" },
              { label: `${cfg.market.hub} summer–winter spread`, value: "+€4.20/MWh", caption: "Storage economics positive" },
              { label: "Regulatory", value: "REMIT stable", caption: "No new reporting changes" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.caption}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Action */}
        <section className="mt-8 flex items-center gap-4">
          <button
            onClick={runScan}
            disabled={status === "loading"}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "done" ? "Re-run market scan" : "Run market scan"}
          </button>
          {status === "loading" && (
            <span className="text-sm text-muted-foreground">
              Aggregating data feeds and scoring counterparties…
            </span>
          )}
          {status === "done" && !error && (
            <span className="text-sm text-muted-foreground">
              {results.length} counterparties scored · sorted by Fit
            </span>
          )}
        </section>

        {/* Error / fallback notice */}
        {status === "done" && error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Workflow unavailable — showing sample data without AI scoring.{" "}
              <span className="text-amber-700/80">({error})</span>
            </span>
          </div>
        )}

        {/* Results */}
        {status === "done" && (
          <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Annual volume</th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-accent" />
                      AI insight
                    </span>
                  </th>
                  <th className="px-4 py-3">Fit score</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.rank} className="border-t border-border align-top">
                    <td className="px-4 py-4 font-semibold text-muted-foreground">{p.rank}</td>
                    <td className="px-4 py-4 font-semibold text-foreground">{p.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{p.country}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">{p.volume}</span>
                        {p.belowTarget && (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Below target
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 max-w-md text-foreground/80">
                      <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </span>
                      {p.insight}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${bandBarColor(p.band)}`}
                            style={{ width: `${p.fit ?? 0}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold ${bandTextColor(p.band)}`}>
                          {p.fit ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        to="/stage-3"
                        search={{ company: p.name }}
                        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className="mt-10">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to scenarios
          </Link>
        </div>
      </main>
    </div>
  );
}
