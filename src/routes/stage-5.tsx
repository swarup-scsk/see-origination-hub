import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/stage-5")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 5 — Pricing | SEE Origination Hub" },
      { name: "description", content: "Pricing & valuation — coming next." },
    ],
  }),
  component: Stage5,
});

function Stage5() {
  const { company } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader stageLabel="Stage 5 of 9" current={5} />

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          Coming next
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Stage 5 — Pricing &amp; Valuation
        </h1>
        {company && (
          <p className="mt-4 text-base text-foreground">
            Counterparty: <span className="font-semibold">{company}</span>
          </p>
        )}
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          This is where we'll value the storage swing as a summer–winter spread option
          against the seasonal curve — numbers computed deterministically, narrated by AI.
        </p>
        <Link
          to="/stage-4"
          search={{ company }}
          className="mt-8 inline-flex items-center justify-center rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← Back to structuring
        </Link>
      </main>
    </div>
  );
}
