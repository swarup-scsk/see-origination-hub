import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";


export const Route = createFileRoute("/stage-3")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  head: () => ({
    meta: [
      { title: "Stage 3 — Qualification | SEE Origination Hub" },
      { name: "description", content: "Qualification stage — coming next." },
    ],
  }),
  component: Stage3,
});

function Stage3() {
  const { company } = Route.useSearch();

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
              <div className="text-xs text-muted-foreground">
                Gas Supply + Storage · Northwest Europe
              </div>
            </div>
          </Link>
          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Stage 3 of 9
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          Coming next
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Stage 3 — Qualification
        </h1>
        {company && (
          <p className="mt-4 text-base text-foreground">
            Selected counterparty: <span className="font-semibold">{company}</span>
          </p>
        )}
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          This is where we'll deep-dive credit, regulatory standing, demand profile, and
          decision-maker access for the selected prospect.
        </p>
        <Link
          to="/stage-2"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← Back to prospecting
        </Link>
      </main>
    </div>
  );
}
