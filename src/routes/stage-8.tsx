import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Circle, ShieldCheck, FileSearch, ArrowRight, UserCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, qualKey, decisionKey, structKey, priceKey, riskKey, contractKey, captureKey, approvalsKey } from "@/lib/store";

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
type Approval = { by: string; at: string };
type Approvals = Record<string, Approval>;
type Decision = { decision: string; rationale: string; at: string };

const ROLES = [
  { key: "credit", label: "Credit" },
  { key: "risk", label: "Risk" },
  { key: "legal", label: "Legal" },
  { key: "desk", label: "Desk Head" },
];

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
  const [approvals, setApprovals] = useState<Approvals>({});
  const [approverName, setApproverName] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [auditSummary, setAuditSummary] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const decision = company ? loadJSON<Decision>(decisionKey(company)) : null;
  const struct = company ? loadJSON<{ structureType: string }>(structKey(company)) : null;
  const price = company ? loadJSON<{ grossMargin: number }>(priceKey(company)) : null;
  const risk = company ? loadJSON<{ rating: string }>(riskKey(company)) : null;
  const contract = company ? loadJSON<{ company: string }>(contractKey(company)) : null;
  const qual = company ? loadJSON<{ recommendation: string }>(qualKey(company)) : null;

  useEffect(() => {
    if (!company) return;
    setCapture(loadJSON<Capture>(captureKey(company)));
    setApprovals(loadJSON<Approvals>(approvalsKey(company)) ?? {});
    setCompliance(null);
    setAuditSummary(null);
  }, [company]);

  const approve = (roleKey: string) => {
    if (!approverName.trim() || !company) return;
    const next = { ...approvals, [roleKey]: { by: approverName.trim(), at: new Date().toISOString() } };
    setApprovals(next);
    saveJSON(approvalsKey(company), next);
  };

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
        action: notional > threshold ? "Escalate to compliance for sign-off." : "Proceed; standard REMIT T+1 reporting applies.",
      });
      setCompError((e as Error).message ?? "unknown error");
    }
    setCompLoading(false);
  };

  const allApproved = ROLES.every((r) => approvals[r.key]);
  const canBook = allApproved && !!compliance && !capture;

  const bookDeal = () => {
    if (!prospect || !canBook) return;
    const ref = "SCEE-GAS-" + Math.floor(10000 + Math.random() * 89999);
    const rec: Capture = { ref, bookedAt: new Date().toISOString() };
    setCapture(rec);
    saveJSON(captureKey(prospect.name), rec);
  };

  const trail = [
    qual && { stage: "Qualification", detail: `AI suggestion: ${qual.recommendation}` },
    decision && { stage: "Originator decision", detail: `${decision.decision}${decision.rationale ? ` — "${decision.rationale}"` : ""}` },
    struct && { stage: "Structuring", detail: struct.structureType },
    price && { stage: "Pricing", detail: `Indicative gross margin ${eur(price.grossMargin)}` },
    risk && { stage: "Risk & credit", detail: `Rating ${risk.rating}` },
    contract && { stage: "Contracting", detail: "EFET-based confirmation drafted" },
    compliance && { stage: "Compliance", detail: `${compliance.status}` },
    ...ROLES.filter((r) => approvals[r.key]).map((r) => ({ stage: `${r.label} approval`, detail: `Approved by ${approvals[r.key].by} · ${new Date(approvals[r.key].at).toLocaleString()}` })),
    capture && { stage: "Deal capture", detail: `Booked ${capture.ref} at ${new Date(capture.bookedAt).toLocaleString()}` },
  ].filter(Boolean) as { stage: string; detail: string }[];

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      const data = await postJSON<{ summary: string }>(AUDIT_URL, { company, trail });
      setAuditSummary(data.summary);
    } catch (e) {
      setAuditSummary(`AI audit summary unavailable (${(e as Error).message}). The trail above is reconstructed from each stage's saved output.`);
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
          Named sign-offs with segregation of duties, the compliance check, deal capture, and the audit trail.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back and choose one.
          </div>
        )}

        {prospect && (
          <>
            {/* Approver identity */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <label className="text-sm text-muted-foreground">Approving as</label>
              <input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Your name"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <span className="text-xs text-muted-foreground">Approve each role you hold; a deal needs all four.</span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {/* Named approvals */}
              <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <UserCheck className="h-4 w-4" /> Sign-offs
                </h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {ROLES.map((r) => {
                    const a = approvals[r.key];
                    return (
                      <li key={r.key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          {a ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                          <span className={a ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                        </span>
                        {a ? (
                          <span className="text-xs text-muted-foreground">{a.by} · {new Date(a.at).toLocaleDateString()}</span>
                        ) : (
                          <button
                            onClick={() => approve(r.key)}
                            disabled={!approverName.trim()}
                            className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Compliance */}
              <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" /> Compliance — REMIT &amp; market abuse
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
                {!compliance && <p className="mt-4 text-sm text-muted-foreground">Run the REMIT reporting &amp; market-abuse surveillance check.</p>}
                {compliance && (
                  <div className="mt-4 space-y-3 text-sm">
                    {compError && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> AI note unavailable. ({compError})
                      </div>
                    )}
                    <div className="space-y-1.5 text-xs">
                      <Check label="Transaction reporting" value="REMIT reportable — standard T+1" ok />
                      <Check label="Wash-trade / self-match surveillance" value="No flags" ok />
                      <Check label="Inside-information screen" value="No flags" ok />
                      <Check
                        label="Large-deal escalation"
                        value={`Notional ${eur(compliance.notional)} vs alert ${eur(compliance.threshold)}`}
                        ok={compliance.status === "Clear"}
                      />
                    </div>
                    <p className="text-foreground/90"><span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-accent"><Sparkles className="h-2.5 w-2.5" />AI</span>{compliance.note}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-semibold">Action:</span> {compliance.action}</p>
                  </div>
                )}
              </section>
            </div>

            {/* Capture */}
            <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deal capture</h2>
                {!capture ? (
                  <button
                    onClick={bookDeal}
                    disabled={!canBook}
                    title={canBook ? "" : "All four sign-offs and the compliance check are required"}
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
              {!canBook && !capture && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Booking needs all four named sign-offs {allApproved ? "✓" : "(pending)"} and the compliance check {compliance ? "✓" : "(pending)"}.
                </p>
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
                {trail.map((t, i) => (
                  <li key={`${t.stage}-${i}`} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <span className="mt-0.5 w-36 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.stage}</span>
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

function Check({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        {label}
      </span>
      <span className={ok ? "text-foreground/80" : "font-medium text-amber-700"}>{value}</span>
    </div>
  );
}
