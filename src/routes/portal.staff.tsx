import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/portal/PortalAuth";

export const Route = createFileRoute("/portal/staff")({ component: StaffPortal });
function StaffPortal() {
  return <PortalAuth portal="staff" />;
}
