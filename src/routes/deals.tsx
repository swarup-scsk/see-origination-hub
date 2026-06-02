import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ArrowRight, Database } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useConfig } from "@/lib/config";
import { PROSPECTS } from "@/lib/prospects";
import { loadJSON, qualKey, structKey, priceKey, riskKey, contractKey, captureKey } from "@/lib/store";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals | SEE Origination Hub" },
      { name: "description", content: "Portfolio of origination deals." },
    ],
  }),
  component: Deals,
});

type Row = {
  company: string;
  hub: string;
  volumeGWh: number;
  stage: string;
  status: "Booked" | "In progress" | "Not started";
  ref?: string;
  grossMargin?: number;
  rating?: string;
};

const eur = (n: number) => "€" + Math.round(n).toLocaleString();

// Domain: the systems an origination desk's deal book would integrate with.
const SYSTEMS = [
  { key: "etrm", name: "ETRM / CTRM", detail: "Trade & position capture (e.g. Endur, Aligne)" },
  { key: "crm", name: "CRM", detail: "Counterparty & relationship records" },
  { key: "marketdata", name: "Market data", detail: "Curves & storage (GIE AGSI+, ENTSOG)" },
  { key: "remit", name: "REMIT reporting", detail: "RRM / ARIS transaction reporting" },
  { key: "credit", name: "Credit & collateral", detail: "Exposure, limits & margining" },
];

function buildRow(company: string, hub: string, volumeGWh: number): Row {
  const capture = loadJSON<{ ref: string }>(captureKey(company));
  const contract = loadJSON<{ company: string }>(contractKey(company));
  const risk = loadJSON<{ rating: string }>(riskKey(company));
  const price = loadJSON<{ grossMargin: number }>(priceKey(company));
  const struct = loadJSON<{ company: string }>(structKey(company));
  const qual = loadJSON<{ recommendation: string }>(qualKey(company));

  let stage = "Not started";
  if (capture) stage = "Booked & live";
  else if (contract) stage = "Contracting";
  else if (risk || price || struct) stage = "Deal analysis";
  else if (qual) stage = "Qualified";

  const status: Row["status"] = capture ? "Booked" : qual || struct ? "In progress" : "Not started";

  return {
    company,
    hub,
    volumeGWh,
    stage,
    status,
    ref: capture?.ref,
    grossMargin: price?.grossMargin,
    rating: risk?.rating,
  };
}

function Deals() {
  const [cfg] = useConfig();
  const [synced, setSynced] = useState<Record<string, string>>({});

  const rows = PROSPECTS.map((p) => buildRow(p.name, cfg.market.hub, p.volumeGWh)).filter(
    (r) => r.status !== "Not started",
  );

  const sync = (key: string, name: string) => {
    setSynced((s) => ({ ...s, [key]: new Date().toLocaleTimeString() }));
    toast.success(`Synced with ${name}`);
  };
  const syncAll = () => {
    const now = new Date().toLocaleTimeString();
    setSynced(Object.fromEntries(SYSTEMS.map((s) => [s.key, now])));
    toast.success("Synced with all connected systems");
  };

  const statusBadge = (s: Row["status"]) =>
    s === "Booked" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Deals" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">Portfolio</span>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Deals</h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              Origination deals in progress and booked, with their key economics.
            </p>
          </div>
          <button
            onClick={syncAll}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Sync all systems
          </button>
        </div>

        {/* Deals table */}
        <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No deals yet. Start one from{" "}
              <Link to="/" className="font-medium text-foreground underline">
                Scenario selection
              </Link>
              .
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Counterparty</th>
                  <th className="px-4 py-3">Hub</th>
                  <th className="px-4 py-3">Volume</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Gross margin</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.company} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-foreground">{r.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.hub}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.volumeGWh.toLocaleString()} GWh/yr</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge(r.status)}`}>
                        {r.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/90">{r.grossMargin ? eur(r.grossMargin) : "—"}</td>
                    <td className="px-4 py-3 text-foreground/90">{r.rating ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.ref ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={r.status === "Booked" ? "/stage-9" : "/deal"}
                        search={{ company: r.company }}
                        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Connected systems */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Connected systems
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEMS.map((s) => (
              <div key={s.key} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                <div>
                  <div className="text-sm font-semibold text-foreground">{s.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {synced[s.key] ? `Synced ${synced[s.key]}` : "Not synced this session"}
                  </div>
                </div>
                <button
                  onClick={() => sync(s.key, s.name)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Illustrative connectors — in production these would be live integrations to the desk's trade,
            relationship, market-data, regulatory-reporting and credit systems.
          </p>
        </section>
      </main>
    </div>
  );
}
