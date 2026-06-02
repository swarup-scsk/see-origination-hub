import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, qualKey, decisionKey } from "@/lib/store";

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
  company: string;
  recommendation: "Proceed" | "Hold" | "Decline";
  rationale: string;
  fit: number;
  fitGreen: number;
  fitAmber: number;
  volumeGWh: number;
  minVol: number;
  targetMet: boolean;
  indicativeSwingGWh: number;
  assessment: { demandFit: string; sizing: string; keyRisk: string };
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

function Row({ label, children, ai }: { label: string; children: React.ReactNode; ai?: boolean }) {
  return (
    <tr className="border-t border-border align-top">
      <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {ai && <Sparkles className="h-3 w-3 text-accent" />}
          {label}
        </span>
      </th>
      <td className="px-4 py-3 text-sm text-foreground/90">{children}</td>
    </tr>
  );
}

function Stage3() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [qual, setQual] = useState<Qualification | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Human decision (decision-support, not auto-decide).
  type Decision = { decision: "Proceed" | "Hold" | "Decline"; rationale: string; at: string };
  const [choice, setChoice] = useState<"" | Decision["decision"]>("");
  const [rationale, setRationale] = useState("");
  const [recorded, setRecorded] = useState<Decision | null>(null);

  useEffect(() => {
    if (!company) { setRecorded(null); setChoice(""); setRationale(""); return; }
    const d = loadJSON<Decision>(decisionKey(company));
    setRecorded(d);
    setChoice(d?.decision ?? "");
    setRationale(d?.rationale ?? "");
  }, [company]);

  const recordDecision = () => {
    if (!choice) return;
    const d: Decision = { decision: choice, rationale: rationale.trim(), at: new Date().toISOString() };
    saveJSON(decisionKey(company), d);
    setRecorded(d);
  };

  // Restore a previously generated assessment for this counterparty.
  useEffect(() => {
    if (!company) return;
    const cached = loadJSON<Qualification>(qualKey(company));
    if (cached) {
      setQual(cached);
      setStatus("done");
    } else {
      setStatus("idle");
      setQual(null);
    }
  }, [company]);

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
      const data = (await res.json()) as Qualification;
      setQual(data);
      saveJSON(qualKey(company), data);
      setStatus("done");
    } catch (e) {
      const minVol = fullConfig.prospects.minVolumeGWh;
      const targetMet = prospect.volumeGWh >= minVol;
      const rec: Qualification["recommendation"] = !targetMet
        ? "Hold"
        : prospect.swing >= 80
          ? "Proceed"
          : "Hold";
      const fallback: Qualification = {
        company: prospect.name,
        recommendation: rec,
        rationale: "Computed locally — AI brief unavailable (workflow not reachable).",
        fit: prospect.swing,
        fitGreen: fullConfig.prospects.fitGreen,
        fitAmber: fullConfig.prospects.fitAmber,
        volumeGWh: prospect.volumeGWh,
        minVol,
        targetMet,
        indicativeSwingGWh: Math.round(prospect.volumeGWh * 0.2),
        assessment: {
          demandFit: "Pending — AI workflow not reachable.",
          sizing: "Pending — AI workflow not reachable.",
          keyRisk: "Pending — AI workflow not reachable.",
        },
      };
      setQual(fallback);
      saveJSON(qualKey(company), fallback);
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 3 of 9" current={3} />

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

              {/* Relationship layer */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relationship</div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div><dt className="inline text-muted-foreground">Contact: </dt><dd className="inline text-foreground">{prospect.primaryContact}</dd></div>
                  <div><dt className="inline text-muted-foreground">Standing: </dt><dd className="inline text-foreground">{prospect.relationship}</dd></div>
                  <div><dt className="inline text-muted-foreground">Last contact: </dt><dd className="inline text-foreground">{prospect.lastContact}</dd></div>
                </dl>
              </div>

              {/* Provenance */}
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Evidence behind the estimates
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {prospect.dataSources.map((d) => (
                    <li key={d} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      {d}
                    </li>
                  ))}
                </ul>
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

                  {/* Structured assessment table */}
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full">
                      <tbody>
                        <Row label="AI suggestion">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${recBadge(qual.recommendation)}`}>
                            {qual.recommendation}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">decision-support only — yours to decide</span>
                        </Row>
                        <Row label="Suggestion basis">
                          <span className="text-muted-foreground">{qual.rationale}</span>
                        </Row>
                        <Row label="Fit score">
                          <span className="font-semibold">{qual.fit}</span>{" "}
                          <span className="text-muted-foreground">
                            (green ≥ {qual.fitGreen} · amber ≥ {qual.fitAmber})
                          </span>
                        </Row>
                        <Row label="Volume vs target">
                          <span className="font-semibold">
                            {qual.volumeGWh.toLocaleString()} GWh
                          </span>{" "}
                          <span className="text-muted-foreground">
                            (target ≥ {qual.minVol.toLocaleString()} —{" "}
                            {qual.targetMet ? "met" : "below"})
                          </span>
                        </Row>
                        <Row label="Indicative swing">
                          ~{qual.indicativeSwingGWh.toLocaleString()} GWh
                        </Row>
                        <Row label="Demand-profile fit" ai>
                          {qual.assessment?.demandFit}
                        </Row>
                        <Row label="Indicative sizing" ai>
                          {qual.assessment?.sizing}
                        </Row>
                        <Row label="Key risk" ai>
                          {qual.assessment?.keyRisk}
                        </Row>
                      </tbody>
                    </table>
                  </div>

                  {/* Human decision capture */}
                  <div className="rounded-lg border border-border bg-secondary/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Your decision
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["Proceed", "Hold", "Decline"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setChoice(opt)}
                          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                            choice === opt
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="Rationale (captured to the audit trail)…"
                      rows={2}
                      className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        onClick={recordDecision}
                        disabled={!choice}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Record decision
                      </button>
                      {recorded && (
                        <span className="text-xs text-muted-foreground">
                          Recorded: <span className="font-semibold text-foreground">{recorded.decision}</span> ·{" "}
                          {new Date(recorded.at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Forward navigation gated on the recorded decision */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {recorded?.decision === "Proceed" && (
                      <Link
                        to="/deal"
                        search={{ company: prospect.name }}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Proceed to deal analysis →
                      </Link>
                    )}
                    {recorded && recorded.decision !== "Proceed" && (
                      <span className="text-sm text-muted-foreground">
                        Marked “{recorded.decision}”. Re-decide above to take it forward, or
                      </span>
                    )}
                    <Link
                      to="/stage-2"
                      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <PauseCircle className="h-4 w-4" />
                      Back to pipeline
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
