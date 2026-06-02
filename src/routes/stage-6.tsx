import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, riskKey } from "@/lib/store";

const WEBHOOK_URL = "http://localhost:5678/webhook/risk";

export const Route = createFileRoute("/stage-6")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 6 — Risk & Credit | SEE Origination Hub" },
      { name: "description", content: "Assess risk and counterparty credit." },
    ],
  }),
  component: Stage6,
});

type Line = { label: string; value: string };
type Risk = {
  company: string;
  rating: string;
  register: Line[];
  narrative: { riskSummary: string; creditView: string; mitigants: string; kycNote: string };
};

const eur = (n: number) => "€" + Math.round(n).toLocaleString();

function Stage6() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [risk, setRisk] = useState<Risk | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    const cached = loadJSON<Risk>(riskKey(company));
    if (cached) {
      setRisk(cached);
      setStatus("done");
    } else {
      setStatus("idle");
      setRisk(null);
    }
  }, [company]);

  const runRisk = async () => {
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
      const data = (await res.json()) as Risk;
      setRisk(data);
      saveJSON(riskKey(company), data);
      setStatus("done");
    } catch (e) {
      const annual = prospect.volumeGWh;
      const cv = annual * 1000 * 30;
      const collateralPct = prospect.credit >= 85 ? 0.05 : prospect.credit >= 70 ? 0.12 : 0.2;
      const rating =
        prospect.credit >= 85 ? "Strong (A)" : prospect.credit >= 70 ? "Adequate (BBB)" : prospect.credit >= 60 ? "Watch (BB)" : "Weak (B)";
      const fallback: Risk = {
        company: prospect.name,
        rating,
        register: [
          { label: "Credit rating (indicative)", value: rating },
          { label: "Annual contract value", value: eur(cv) },
          { label: "Recommended collateral / PCG", value: `${eur(cv * collateralPct)} (${Math.round(collateralPct * 100)}%)` },
          { label: "Volumetric / swing risk", value: "~20% of volume is seasonal swing" },
          { label: "Basis risk", value: `${cfg.market.hub} delivery point` },
          { label: "Shape risk", value: "Winter-weighted withdrawal profile" },
        ],
        narrative: {
          riskSummary: "AI narrative unavailable (workflow not reachable).",
          creditView: "AI narrative unavailable.",
          mitigants: "AI narrative unavailable.",
          kycNote: "AI narrative unavailable.",
        },
      };
      setRisk(fallback);
      saveJSON(riskKey(company), fallback);
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 6 of 9" current={6} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          Risk &amp; credit
        </span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Assess risk &amp; credit
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Review volumetric, basis and shape risk, indicative credit standing and collateral,
          with an AI risk summary and a KYC note.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back and choose one.
          </div>
        )}

        {prospect && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold text-foreground">{prospect.name}</span>
                <span className="text-muted-foreground">
                  {" "}· credit {prospect.credit}/100 · {prospect.volumeGWh.toLocaleString()} GWh/yr
                </span>
              </div>
              <button
                onClick={runRisk}
                disabled={status === "loading"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
                {risk ? "Re-assess" : "Run risk & credit check"}
              </button>
            </div>

            {status === "loading" && (
              <p className="mt-6 text-sm text-muted-foreground">
                Computing exposure and drafting the risk assessment…
              </p>
            )}

            {status === "done" && risk && (
              <div className="mt-6 grid gap-6 md:grid-cols-5">
                <section className="md:col-span-3 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-secondary/60 px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">Risk &amp; credit register</h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {risk.register.map((l) => (
                        <tr key={l.label} className="border-t border-border first:border-t-0">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {l.label}
                          </th>
                          <td className="px-4 py-3 text-right font-medium text-foreground/90">{l.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="md:col-span-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-3">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <h2 className="text-sm font-semibold text-foreground">AI risk assessment</h2>
                  </div>
                  <div className="space-y-4 p-4 text-sm">
                    {error && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        AI narrative unavailable. ({error})
                      </div>
                    )}
                    {[
                      ["Overall risk", risk.narrative.riskSummary],
                      ["Credit view", risk.narrative.creditView],
                      ["Recommended mitigants", risk.narrative.mitigants],
                      ["KYC note", risk.narrative.kycNote],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                        <p className="mt-1 text-foreground/90">{val}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {status === "done" && risk && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/stage-7"
                  search={{ company: prospect.name }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Proceed to contracting
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link
            to="/stage-5"
            search={{ company }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to pricing
          </Link>
        </div>
      </main>
    </div>
  );
}
