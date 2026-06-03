import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Pricing lives in the unified Deal Analysis workspace (/deal). Robust client-side redirect.
export const Route = createFileRoute("/stage-5")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  component: RedirectToDeal,
});

function RedirectToDeal() {
  const { company } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/deal", search: { company }, replace: true });
  }, [company, navigate]);
  return null;
}
