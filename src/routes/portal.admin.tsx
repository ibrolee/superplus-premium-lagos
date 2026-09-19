import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/portal/PortalAuth";

export const Route = createFileRoute("/portal/admin")({ component: AdminPortal });
function AdminPortal() { return <PortalAuth portal="admin" />; }
