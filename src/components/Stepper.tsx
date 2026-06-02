import { ChevronRight, Check } from "lucide-react";

const STEPS = [
  "Scenario",
  "Prospecting",
  "Qualification",
  "Structuring",
  "Pricing",
  "Risk & Credit",
  "Contracting",
  "Approval",
  "Lifecycle",
];

export function Stepper({ current }: { current: number }) {
  return (
    <nav className="border-b border-border bg-secondary/30">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6 py-2 text-xs">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <div key={label} className="flex shrink-0 items-center gap-1">
              <span
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "text-emerald-700"
                      : "text-muted-foreground")
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
