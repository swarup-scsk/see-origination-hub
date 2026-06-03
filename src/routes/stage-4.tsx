import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Structuring lives in the unified Deal Analysis workspace (/deal).
// Robust client-side redirect (kept so stepper links / old URLs still resolve).
export const Route = createFileRoute("/stage-4")({
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
