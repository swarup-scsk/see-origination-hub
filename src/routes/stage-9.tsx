import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useConfig } from "@/lib/config";
import { findProspect } from "@/lib/prospects";
import { loadJSON, priceKey, captureKey } from "@/lib/store";

export const Route = createFileRoute("/stage-9")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 9 — Lifecycle | SEE Origination Hub" },
      { name: "description", content: "Nominations, settlement and P&L snapshot." },
    ],
  }),
  component: Stage9,
});

const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
// Winter-weighted withdrawal profile (sums to 1).
const WEIGHTS = [0.12, 0.135, 0.145, 0.145, 0.12, 0.10, 0.055, 0.035, 0.025, 0.025, 0.03, 0.045];
const eur = (n: number) => "€" + Math.round(n).toLocaleString();

function Stage9() {
  const { company } = Route.useSearch();
  const [cfg] = useConfig();
  const prospect = findProspect(company);
  const price = company ? loadJSON<{ grossMargin: number }>(priceKey(company)) : null;
  const capture = company ? loadJSON<{ ref: string; bookedAt: string }>(captureKey(company)) : null;

  const annual = prospect?.volumeGWh ?? 0;
  const monthly = WEIGHTS.map((w) => Math.round(annual * w));
  const maxM = Math.max(...monthly, 1);
  const gross = price?.grossMargin ?? 0;
  const mtm = Math.round(gross * 0.06); // illustrative favourable move
  const realised = Math.round(gross * 0.18); // ~2 winter months elapsed

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 9 of 9" current={9} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">Lifecycle</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Lifecycle &amp; settlement</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Live deal: nominations and scheduling, settlement and P&amp;L snapshot.
        </p>

        {!prospect && (
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No counterparty selected. Go back and choose one.
          </div>
        )}

        {prospect && (
          <>
            {/* Deal banner */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
              <div className="inline-flex items-center gap-2 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold">{capture?.ref ?? "Deal not yet booked"}</span>
                <span className="text-emerald-800/80">· {prospect.name} · {cfg.market.hub} · Active</span>
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Indicative gross margin", value: eur(gross) },
                { label: "Realised P&L (to date)", value: eur(realised) },
                { label: "Open MTM", value: "+" + eur(mtm) },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Nomination schedule */}
            <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-secondary/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Nomination schedule (gas year, GWh)</h2>
              </div>
              <div className="grid grid-cols-12 items-end gap-2 px-4 py-5" style={{ height: 160 }}>
                {monthly.map((v, i) => (
                  <div key={MONTHS[i]} className="flex h-full flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-muted-foreground">{v}</span>
                    <div
                      className={`w-full rounded-t ${i < 6 ? "bg-primary" : "bg-primary/40"}`}
                      style={{ height: `${(v / maxM) * 100}%` }}
                      title={`${MONTHS[i]}: ${v} GWh`}
                    />
                    <span className="text-[10px] text-muted-foreground">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                Winter months (Oct–Mar, darker) carry the storage withdrawal; summer is injection/baseload.
              </p>
            </section>

            {/* Settlement snapshot */}
            <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-secondary/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Settlement snapshot</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Delivery point", cfg.market.hub],
                    ["Annual contract quantity", `${annual.toLocaleString()} GWh`],
                    ["Invoicing", "Monthly, arrears"],
                    ["Collateral", "PCG in place"],
                    ["Status", "Active — nominations running"],
                  ].map(([l, v]) => (
                    <tr key={l} className="border-t border-border first:border-t-0">
                      <th className="w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{l}</th>
                      <td className="px-4 py-3 text-foreground/90">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="mt-8 rounded-lg border border-border bg-secondary/40 px-5 py-4 text-sm text-muted-foreground">
              End of the origination cycle — from cold prospect to a booked, lifecycle-managed deal.
            </div>
          </>
        )}

        <div className="mt-10 flex gap-4">
          <Link to="/stage-8" search={{ company }} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to approval
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ↺ Start a new origination
          </Link>
        </div>
      </main>
    </div>
  );
}
