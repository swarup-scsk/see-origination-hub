import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, structKey } from "@/lib/store";

const WEBHOOK_URL = "http://localhost:5678/webhook/structure";

export const Route = createFileRoute("/stage-4")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 4 — Structuring | SEE Origination Hub" },
      { name: "description", content: "Structure the supply + storage deal." },
    ],
  }),
  component: Stage4,
});

type Leg = { component: string; detail: string };
type Structure = {
  company: string;
  structureType: string;
  legs: Leg[];
  rationale: {
    structureRationale: string;
    swingProfile: string;
    optionality: string;
    riskNote: string;
  };
};

function Stage4() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [structure, setStructure] = useState<Structure | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    const cached = loadJSON<Structure>(structKey(company));
    if (cached) {
      setStructure(cached);
      setStatus("done");
    } else {
      setStatus("idle");
      setStructure(null);
    }
  }, [company]);

  const runStructure = async () => {
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
      const data = (await res.json()) as Structure;
      setStructure(data);
      saveJSON(structKey(company), data);
      setStatus("done");
    } catch (e) {
      // Deterministic fallback (no AI rationale).
      const swing = Math.round(prospect.volumeGWh * 0.2);
      const base = prospect.volumeGWh - swing;
      const fallback: Structure = {
        company: prospect.name,
        structureType: "Supply + Storage seasonal swing contract",
        legs: [
          { component: "Supply (baseload)", detail: `${base.toLocaleString()} GWh/yr flat at ${cfg.market.hub}` },
          { component: "Storage (swing)", detail: `~${swing.toLocaleString()} GWh winter withdrawal / summer injection` },
          { component: "Transport / capacity", detail: `Entry-exit capacity to ${cfg.market.hub} delivery` },
          { component: "Tenor", detail: "2 gas years (Oct–Sep)" },
          { component: "Indexation", detail: `${cfg.market.hub} month-ahead` },
        ],
        rationale: {
          structureRationale: "AI rationale unavailable (workflow not reachable).",
          swingProfile: "AI rationale unavailable.",
          optionality: "AI rationale unavailable.",
          riskNote: "AI rationale unavailable.",
        },
      };
      setStructure(fallback);
      saveJSON(structKey(company), fallback);
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 4 of 9" current={4} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          Structuring
        </span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Structure the deal
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Assemble the supply, storage and transport legs into a structured seasonal-swing
          contract, with an AI rationale for the shape.
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
                  {" "}· {prospect.sector} · {prospect.volumeGWh.toLocaleString()} GWh/yr · {cfg.market.hub}
                </span>
              </div>
              <button
                onClick={runStructure}
                disabled={status === "loading"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
                {structure ? "Re-generate structure" : "Generate structure"}
              </button>
            </div>

            {status === "loading" && (
              <p className="mt-6 text-sm text-muted-foreground">
                Assembling legs and drafting the structuring rationale…
              </p>
            )}

            {status === "done" && structure && (
              <div className="mt-6 space-y-6">
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Workflow unavailable — showing the term sheet without AI rationale. ({error})
                  </div>
                )}

                {/* Term sheet */}
                <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-secondary/60 px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Indicative term sheet — {structure.structureType}
                    </h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {structure.legs.map((leg) => (
                        <tr key={leg.component} className="border-t border-border first:border-t-0">
                          <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {leg.component}
                          </th>
                          <td className="px-4 py-3 text-foreground/90">{leg.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* AI rationale */}
                <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-3">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <h2 className="text-sm font-semibold text-foreground">AI structuring rationale</h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["Why this structure", structure.rationale.structureRationale],
                        ["Seasonal swing profile", structure.rationale.swingProfile],
                        ["Embedded optionality", structure.rationale.optionality],
                        ["Structuring risk", structure.rationale.riskNote],
                      ].map(([label, val]) => (
                        <tr key={label} className="border-t border-border first:border-t-0 align-top">
                          <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {label}
                          </th>
                          <td className="px-4 py-3 text-foreground/90">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/stage-5"
                    search={{ company: prospect.name }}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Proceed to pricing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link
            to="/stage-3"
            search={{ company }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to qualification
          </Link>
        </div>
      </main>
    </div>
  );
}
