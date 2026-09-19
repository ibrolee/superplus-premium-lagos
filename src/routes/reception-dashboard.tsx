import { createFileRoute, Navigate } from "@tanstack/react-router";

// Preserve the old URL for bookmarks without loading its retired dashboard,
// running legacy member queries or exposing any legacy actions.
export const Route = createFileRoute("/reception-dashboard")({
  component: () => <Navigate to="/reception-workspace" replace />,
});
