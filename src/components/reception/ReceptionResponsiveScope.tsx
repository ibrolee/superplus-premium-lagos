import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import "@/reception-responsive.css";

const routes = new Set([
  "/reception-workspace", "/reception-checkin", "/management-members", "/management-profiles", "/management-attendance", "/management-operations", "/management-standard-plan", "/management-custom-plan", "/management-communications", "/management-preview",
]);
export function ReceptionResponsiveScope() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  useEffect(() => {
    const eligible = routes.has(pathname) || pathname.startsWith("/reception-member/");
    if (eligible) document.documentElement.dataset.spfReception = "true";
    else delete document.documentElement.dataset.spfReception;
    return () => { delete document.documentElement.dataset.spfReception; };
  }, [pathname]);
  return null;
}
