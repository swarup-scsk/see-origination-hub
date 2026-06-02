import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useConfig, scopeSubtitle } from "@/lib/config";

type Props = {
  stageLabel?: string;
  subtitleOverride?: string;
};

export function AppHeader({ stageLabel, subtitleOverride }: Props) {
  const [cfg] = useConfig();
  const subtitle = subtitleOverride ?? scopeSubtitle(cfg);

  return (
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
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {stageLabel && (
            <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {stageLabel}
            </div>
          )}
          <Link
            to="/config"
            aria-label="Open configuration"
            title="Configuration"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
