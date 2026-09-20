import { createFileRoute, Outlet } from "@tanstack/react-router";

// The blog listing lives at /blog (index child); article routes render through this outlet.
// Without an outlet, /blog/article and /blog/$slug match but display the listing instead.
export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return <Outlet />;
}
