import { ChevronRight, Check } from "lucide-react";
import { Link, useSearch } from "@tanstack/react-router";

const STEPS = [
  { label: "Scenario", to: "/" as const },
  { label: "Prospecting", to: "/" as const },
  { label: "Qualification", to: "/stage-3" as const },
  { label: "Structuring", to: "/stage-4" as const },
  { label: "Pricing", to: "/stage-5" as const },
  { label: "Risk & Credit", to: "/stage-6" as const },
  { label: "Contracting", to: "/stage-7" as const },
  { label: "Approval", to: "/stage-8" as const },
  { label: "Lifecycle", to: "/stage-9" as const },
];
// Stage 2 (Prospecting) uses /stage-2 too, but index acts as the entry list.
const STAGE_PATHS: Record<number, string> = {
  1: "/",
  2: "/stage-2",
  3: "/stage-3",
  4: "/stage-4",
  5: "/stage-5",
  6: "/stage-6",
  7: "/stage-7",
  8: "/stage-8",
  9: "/stage-9",
};

export function Stepper({ current }: { current: number }) {
  // Preserve ?company across steps when present.
  const search = useSearch({ strict: false }) as { company?: string };
  const company = search?.company ?? "";

  return (
    <nav className="border-b border-border bg-secondary/30">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6 py-2 text-xs">
        {STEPS.map(({ label }, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const reachable = n <= current; // don't let users skip forward
          const to = STAGE_PATHS[n];

          const pill = (
            <span
              className={
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "text-emerald-700 hover:bg-emerald-100"
                    : reachable
                      ? "text-muted-foreground hover:bg-muted"
                      : "text-muted-foreground/60 cursor-not-allowed")
              }
            >
              <span
                className={
                  "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] " +
                  (active
                    ? "bg-primary-foreground/20"
                    : done
                      ? "bg-emerald-100"
                      : "bg-muted")
                }
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              {label}
            </span>
          );

          return (
            <div key={label} className="flex shrink-0 items-center gap-1">
              {reachable && !active ? (
                n === 1 || n === 2 ? (
                  <Link to={to} aria-label={`Go to ${label}`}>
                    {pill}
                  </Link>
                ) : (
                  <Link
                    to={to}
                    search={company ? { company } : undefined}
                    aria-label={`Go to ${label}`}
                  >
                    {pill}
                  </Link>
                )
              ) : (
                pill
              )}
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
