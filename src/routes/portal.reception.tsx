import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/portal/PortalAuth";

export const Route = createFileRoute("/portal/reception")({ component: ReceptionPortal });
function ReceptionPortal() { return <PortalAuth portal="reception" />; }
