import { createFileRoute, redirect } from "@tanstack/react-router";

// Structuring is now part of the unified Deal Analysis workspace (/deal).
// Keep this route for backward compatibility (stepper links, old URLs) and redirect.
export const Route = createFileRoute("/stage-4")({
  validateSearch: (search: Record<string, unknown>) => ({
    company: typeof search.company === "string" ? search.company : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/deal", search: { company: (search as { company?: string }).company ?? "" } });
  },
  component: () => null,
});
