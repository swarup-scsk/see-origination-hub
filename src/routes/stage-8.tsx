import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Circle, ShieldCheck, FileSearch, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, qualKey, structKey, priceKey, riskKey, contractKey, captureKey } from "@/lib/store";

const COMPLIANCE_URL = "http://localhost:5678/webhook/compliance";
const AUDIT_URL = "http://localhost:5678/webhook/audit";

export const Route = createFileRoute("/stage-8")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 8 — Approval | SEE Origination Hub" },
      { name: "description", content: "Sign-off, compliance, capture and audit." },
    ],
  }),
  component: Stage8,
});

type Compliance = { status: "Clear" | "Review required"; notional: number; threshold: number; note: string; action: string };
type Capture = { ref: string; bookedAt: string };

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
const eur = (n: number) => "€" + Math.round(n).toLocaleString();

function Stage8() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [mgmtApproved, setMgmtApproved] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [auditSummary, setAuditSummary] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Cached prior-stage outputs (reconstruct the trail).
  const qual = company ? loadJSON<{ recommendation: string }>(qualKey(company)) : null;
  const struct = company ? loadJSON<{ structureType: string }>(structKey(company)) : null;
  const price = company ? loadJSON<{ grossMargin: number }>(priceKey(company)) : null;
  const risk = company ? loadJSON<{ rating: string }>(riskKey(company)) : null;
  const contract = company ? loadJSON<{ company: string }>(contractKey(company)) : null;

  useEffect(() => {
    if (!company) return;
    setCapture(loadJSON<Capture>(captureKey(company)));
    setCompliance(null);
    setMgmtApproved(false);
    setAuditSummary(null);
  }, [company]);

  const runCompliance = async () => {
    if (!prospect) return;
    const fullConfig = readConfig();
    setCompLoading(true);
    setCompError(null);
    try {
      const data = await postJSON<Compliance>(COMPLIANCE_URL, { config: fullConfig, prospect });
      setCompliance(data);
    } catch (e) {
      const notional = prospect.volumeGWh * 1000 * 30;
      const threshold = fullConfig.compliance.singleDealNotionalAlertEur;
      setCompliance({
        status: notional > threshold ? "Review required" : "Clear",
        notional, threshold,
        note: "AI note unavailable (workflow not reachable).",
        action: notional > threshold ? "Escalate to compliance for sign-off." : "Proceed; standard REMIT reporting applies.",
      });
      setCompError((e as Error).message ?? "unknown error");
    }
    setCompLoading(false);
  };

  const checks = [
    { label: "Structure complete", ok: !!struct },
    { label: "Valuation complete", ok: !!price },
    { label: "Risk & credit cleared", ok: !!risk },
    { label: "Confirmation drafted", ok: !!contract },
    { label: "Compliance check", ok: !!compliance },
    { label: "Management approval", ok: mgmtApproved },
  ];
  const allOk = checks.every((c) => c.ok);

  const bookDeal = () => {
    if (!prospect || !allOk) return;
    const ref = "SCEE-GAS-" + Math.floor(10000 + Math.random() * 89999);
    const rec: Capture = { ref, bookedAt: new Date().toISOString() };
    setCapture(rec);
    saveJSON(captureKey(prospect.name), rec);
  };

  const trail = [
    qual && { stage: "Qualification", detail: `Recommendation: ${qual.recommendation}` },
    struct && { stage: "Structuring", detail: struct.structureType },
    price && { stage: "Pricing", detail: `Indicative gross margin ${eur(price.grossMargin)}` },
    risk && { stage: "Risk & credit", detail: `Rating ${risk.rating}` },
    contract && { stage: "Contracting", detail: "EFET-based confirmation drafted" },
    compliance && { stage: "Compliance", detail: `${compliance.status}` },
    capture && { stage: "Deal capture", detail: `Booked ${capture.ref} at ${new Date(capture.bookedAt).toLocaleString()}` },
  ].filter(Boolean) as { stage: string; detail: string }[];

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const data = await postJSON<{ summary: string }>(AUDIT_URL, { company, trail });
      setAuditSummary(data.summary);
    } catch (e) {
      setAuditSummary(`AI audit summary unavailable (${(e as Error).message}). Decision trail above is reconstructed from each stage's saved output.`);
    }
    setAuditLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 8 of 9" current={8} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">Approval &amp; deal capture</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Approve &amp; book the deal</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Confirm sign-offs, run the compliance check, capture the deal, and reconstruct the audit trail.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back and choose one.
          </div>
        )}

        {prospect && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Sign-off checklist */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sign-off checklist</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                    <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={mgmtApproved} onChange={(e) => setMgmtApproved(e.target.checked)} className="h-4 w-4" />
                Record management approval
              </label>
            </section>

            {/* Compliance */}
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" /> Compliance (REMIT)
                </h2>
                <button
                  onClick={runCompliance}
                  disabled={compLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                >
                  {compLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Run check
                </button>
              </div>
              {!compliance && <p className="mt-4 text-sm text-muted-foreground">Run the REMIT / market-abuse check.</p>}
              {compliance && (
                <div className="mt-4 space-y-2 text-sm">
                  {compError && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> AI note unavailable. ({compError})
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${compliance.status === "Clear" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {compliance.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Notional {eur(compliance.notional)} vs alert {eur(compliance.threshold)}
                    </span>
                  </div>
                  <p className="text-foreground/90"><span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-accent"><Sparkles className="h-2.5 w-2.5" />AI</span> {compliance.note}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-semibold">Action:</span> {compliance.action}</p>
                </div>
              )}
            </section>
          </div>
        )}

        {prospect && (
          <>
            {/* Capture */}
            <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deal capture</h2>
                {!capture ? (
                  <button
                    onClick={bookDeal}
                    disabled={!allOk}
                    title={allOk ? "" : "Complete all sign-offs first"}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    Book deal into ETRM
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Booked · {capture.ref}
                  </span>
                )}
              </div>
              {!allOk && !capture && (
                <p className="mt-3 text-xs text-muted-foreground">Complete all sign-offs (including the compliance check and management approval) to enable booking.</p>
              )}
            </section>

            {/* Audit trail */}
            <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-4 py-3">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <FileSearch className="h-4 w-4" /> Audit trail
                </h2>
                <button
                  onClick={runAudit}
                  disabled={auditLoading || trail.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
                >
                  {auditLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <Sparkles className="h-3.5 w-3.5" /> AI audit summary
                </button>
              </div>
              <ol className="divide-y divide-border">
                {trail.map((t) => (
                  <li key={t.stage} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <span className="mt-0.5 w-32 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.stage}</span>
                    <span className="text-foreground/90">{t.detail}</span>
                  </li>
                ))}
                {trail.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No prior steps recorded yet.</li>}
              </ol>
              {auditSummary && (
                <div className="border-t border-border bg-secondary/30 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-accent"><Sparkles className="h-2.5 w-2.5" />AI summary</span>
                  <p className="mt-1 text-foreground/90">{auditSummary}</p>
                </div>
              )}
            </section>

            {capture && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/stage-9"
                  search={{ company: prospect!.name }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Proceed to lifecycle
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link to="/stage-7" search={{ company }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to contracting
          </Link>
        </div>
      </main>
    </div>
  );
}
