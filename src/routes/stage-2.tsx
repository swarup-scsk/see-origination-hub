import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/stage-2")({
  head: () => ({
    meta: [
      { title: "Stage 2 — Prospecting | SEE Origination Hub" },
      { name: "description", content: "AI-assisted prospecting for Gas Supply + Storage counterparties." },
    ],
  }),
  component: Stage2,
});

type Prospect = {
  rank: number;
  name: string;
  country: string;
  volume: string;
  fit: number;
  insight: string;
};

const prospects: Prospect[] = [
  { rank: 1, name: "Westland Greenhouse Energy Co-op", country: "Netherlands", volume: "1,250 GWh/yr", fit: 92, insight: "Strong winter heating swing; storage-backed flexibility directly addresses their seasonal peak." },
  { rank: 2, name: "Stadswarmte Rotterdam", country: "Netherlands", volume: "980 GWh/yr", fit: 88, insight: "District heating load is highly seasonal; good credit; natural fit for swing supply." },
  { rank: 3, name: "Benelux Power & Heat NV", country: "Belgium", volume: "1,600 GWh/yr", fit: 81, insight: "CHP operator with shoulder-season flexibility needs; larger volume, slightly weaker credit." },
  { rank: 4, name: "NorthSea Industrial Gas BV", country: "Netherlands", volume: "2,100 GWh/yr", fit: 74, insight: "High volume but flat profile; storage value limited unless paired with interruptible terms." },
  { rank: 5, name: "Limburg Regional Supplier", country: "Netherlands", volume: "540 GWh/yr", fit: 69, insight: "Small LDC with clear swing need; volume below target, possible aggregation candidate." },
  { rank: 6, name: "Antwerp Chemicals Cluster", country: "Belgium", volume: "3,400 GWh/yr", fit: 58, insight: "Large but near-flat process demand; little seasonal optionality to monetise." },
];

function fitColor(fit: number) {
  if (fit >= 80) return "bg-emerald-500";
  if (fit >= 65) return "bg-amber-500";
  return "bg-muted-foreground/50";
}

function fitTextColor(fit: number) {
  if (fit >= 80) return "text-emerald-700";
  if (fit >= 65) return "text-amber-700";
  return "text-muted-foreground";
}

function Stage2() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const runScan = () => {
    setStatus("loading");
    setTimeout(() => setStatus("done"), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-bold">SEE</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">SEE Origination Hub</div>
              <div className="text-xs text-muted-foreground">Gas Supply + Storage · Northwest Europe</div>
            </div>
          </Link>
          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Stage 2 of 9
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">AI-assisted</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI-Assisted Prospecting
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Scanning the market for counterparties whose demand profile fits a supply + storage structure.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          We are originating a Gas Supply + Storage deal in Northwest Europe, looking for
          counterparties with seasonal winter swing that our supply + storage portfolio can serve.
        </p>

        {/* Market signals */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Market signals
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "EU gas storage", value: "61% full", caption: "GIE AGSI+, seasonal build underway" },
              { label: "TTF summer–winter spread", value: "+€4.20/MWh", caption: "Storage economics positive" },
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
          {status === "done" && (
            <span className="text-sm text-muted-foreground">
              6 counterparties scored · sorted by Fit
            </span>
          )}
        </section>

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
                {prospects.map((p) => (
                  <tr key={p.rank} className="border-t border-border align-top">
                    <td className="px-4 py-4 font-semibold text-muted-foreground">{p.rank}</td>
                    <td className="px-4 py-4 font-semibold text-foreground">{p.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{p.country}</td>
                    <td className="px-4 py-4 text-muted-foreground">{p.volume}</td>
                    <td className="px-4 py-4 max-w-md text-foreground/80">
                      <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </span>
                      {p.insight}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${fitColor(p.fit)}`} style={{ width: `${p.fit}%` }} />
                        </div>
                        <span className={`text-sm font-semibold ${fitTextColor(p.fit)}`}>{p.fit}</span>
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
