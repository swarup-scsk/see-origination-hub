import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight, Download, Mail } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { readConfig, useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, saveJSON, contractKey } from "@/lib/store";
import { buildDocHtml, downloadDoc, emailDoc, type Section } from "@/lib/docexport";

const WEBHOOK_URL = "http://localhost:5678/webhook/contract";

export const Route = createFileRoute("/stage-7")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 7 — Contracting | SEE Origination Hub" },
      { name: "description", content: "Draft the confirmation and flag off-market terms." },
    ],
  }),
  component: Stage7,
});

type Line = { label: string; value: string };
type Contract = {
  company: string;
  terms: Line[];
  draft: { draftSummary: string; offMarket: string; redline: string };
};

function Stage7() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);

  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    const cached = loadJSON<Contract>(contractKey(company));
    if (cached) { setContract(cached); setStatus("done"); } else { setStatus("idle"); setContract(null); }
  }, [company]);

  const exportSections = (): Section[] => {
    if (!contract) return [];
    return [
      { heading: "Confirmation — key terms", rows: contract.terms.map((t) => [t.label, t.value] as [string, string]) },
      { heading: "AI draft & review", paragraphs: [
        ["Draft confirmation summary", contract.draft.draftSummary],
        ["Off-market terms flagged", contract.draft.offMarket],
        ["Recommended redline", contract.draft.redline],
      ] },
    ];
  };
  const onDownload = () => {
    if (!contract) return;
    const html = buildDocHtml(`Confirmation — ${contract.company}`, "European Federation of Energy Traders (EFET)-based confirmation", exportSections());
    downloadDoc(`SEE-Confirmation-${contract.company.replace(/[^a-z0-9]+/gi, "-")}`, html);
  };
  const onEmail = () => contract && emailDoc(`SEE Origination — Confirmation — ${contract.company}`, exportSections());

  const runContract = async () => {
    if (!prospect) return;
    const fullConfig = readConfig();
    setStatus("loading");
    setError(null);
    try {
      const data = await postJSON<Contract>(WEBHOOK_URL, { config: fullConfig, prospect });
      setContract(data);
      saveJSON(contractKey(company), data);
      setStatus("done");
    } catch (e) {
      const swing = Math.round(prospect.volumeGWh * 0.2);
      const fb: Contract = {
        company: prospect.name,
        terms: termsFor(prospect, cfg.market.hub, swing),
        draft: {
          draftSummary: "AI draft unavailable (workflow not reachable).",
          offMarket: "AI review unavailable.",
          redline: "AI review unavailable.",
        },
      };
      setContract(fb);
      saveJSON(contractKey(company), fb);
      setError((e as Error).message ?? "unknown error");
      setStatus("done");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 7 of 9" current={7} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">Negotiation &amp; contracting</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Draft the confirmation</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Assemble the key terms on a European Federation of Energy Traders (EFET)-based confirmation and have AI flag any off-market terms.
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
                <span className="text-muted-foreground"> · {cfg.market.hub} · European Federation of Energy Traders (EFET) General Agreement</span>
              </div>
              <button
                onClick={runContract}
                disabled={status === "loading"}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
                {contract ? "Re-draft" : "Draft confirmation"}
              </button>
            </div>

            {status === "loading" && (
              <p className="mt-6 text-sm text-muted-foreground">Drafting the confirmation and reviewing terms…</p>
            )}

            {status === "done" && contract && (
              <div className="mt-6 space-y-6">
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Workflow unavailable — showing terms without AI draft. ({error})
                  </div>
                )}
                <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-secondary/60 px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">Confirmation — key terms</h2>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {contract.terms.map((t) => (
                        <tr key={t.label} className="border-t border-border first:border-t-0">
                          <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</th>
                          <td className="px-4 py-3 text-foreground/90">{t.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-4 py-3">
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <h2 className="text-sm font-semibold text-foreground">AI draft &amp; review</h2>
                  </div>
                  <div className="space-y-4 p-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Draft confirmation summary</div>
                      <p className="mt-1 text-foreground/90">{contract.draft.draftSummary}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Off-market terms flagged</div>
                      <p className="mt-1 text-foreground/90">{contract.draft.offMarket}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended redline</div>
                      <p className="mt-1 text-foreground/90">{contract.draft.redline}</p>
                    </div>
                  </div>
                </section>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/stage-8"
                    search={{ company: prospect.name }}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Proceed to approval
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={onDownload}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                  <button
                    onClick={onEmail}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link to="/deal" search={{ company }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to deal analysis
          </Link>
        </div>
      </main>
    </div>
  );
}

function termsFor(p: { name: string; volumeGWh: number }, hub: string, swing: number): Line[] {
  return [
    { label: "Counterparty", value: p.name },
    { label: "Product", value: "Gas supply + storage (seasonal swing)" },
    { label: "Delivery point", value: hub },
    { label: "Annual contract quantity", value: `${p.volumeGWh.toLocaleString()} GWh/yr` },
    { label: "Swing volume", value: `~${swing.toLocaleString()} GWh` },
    { label: "Tenor", value: "2 gas years (Oct–Sep)" },
    { label: "Price index", value: `${hub} month-ahead` },
    { label: "Master agreement", value: "European Federation of Energy Traders (EFET) General Agreement + confirmation" },
  ];
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
