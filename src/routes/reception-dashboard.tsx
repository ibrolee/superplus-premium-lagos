import { createFileRoute, Navigate } from "@tanstack/react-router";

// Keep old bookmarks working without mounting the retired dashboard, making
// its legacy queries, or exposing its actions. Reception 2.0 remains protected
// by its own existing account and role checks.
export const Route = createFileRoute("/reception-dashboard")({
  component: () => <Navigate to="/reception-workspace" replace />,
});
