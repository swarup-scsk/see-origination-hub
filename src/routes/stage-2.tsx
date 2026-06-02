import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/stage-2")({
  head: () => ({
    meta: [
      { title: "Stage 2 — Prospecting | SEE Origination Hub" },
      { name: "description", content: "Prospecting stage — coming next." },
    ],
  }),
  component: Stage2,
});

function Stage2() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-bold">SEE</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                SEE Origination Hub
              </div>
              <div className="text-xs text-muted-foreground">
                Gas Supply + Storage
              </div>
            </div>
          </Link>
          <div className="text-xs font-medium text-muted-foreground">
            Stage 2 of 6
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          Coming next
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Stage 2 — Prospecting
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          This is where we'll identify counterparties, screen opportunities,
          and shape the origination pipeline for the Gas Supply + Storage
          deal.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← Back to scenarios
        </Link>
      </main>
    </div>
  );
}
