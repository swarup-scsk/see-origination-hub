import { createFileRoute, redirect } from "@tanstack/react-router";

// Pricing is now part of the unified Deal Analysis workspace (/deal). Redirect for old links.
export const Route = createFileRoute("/stage-5")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/deal", search: { company: (search as { company?: string }).company ?? "" } });
  },
  component: () => null,
});
