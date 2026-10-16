import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AdminChrome } from "./AdminChrome";
import { useAdminNavigation } from "./AdminNavigationContext";
import "./admin-persistent-navigation.css";

const managementRoles = ["admin", "owner", "manager"];
/** The receptionist's dedicated workspace and scanning/clock-in duties stay separate.
 * Admin management pages and protected member profiles share the persistent navigation.
 */
export function isAdminDestination(pathname: string): boolean {
  if (["/management-standard-plan", "/management-custom-plan"].includes(pathname)) return false;
  return (
    pathname.startsWith("/management-") ||
    ["/staff-admin", "/staff-blog", "/staff-gallery", "/staff-missed-scans"].includes(pathname) ||
    pathname.startsWith("/reception-member/")
  );
}

/** Navigation visibility is not authorisation. Existing destination guards and RLS stay authoritative. */
export function AdminPersistentNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { hasPageNavigation } = useAdminNavigation();
  const eligible = isAdminDestination(pathname) && !hasPageNavigation;
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRole(null);
    if (!eligible)
      return () => {
        cancelled = true;
      };
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) return;
        const { data: staff, error } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (error || !staff?.active || cancelled) return;
        const nextRole = String(staff.role || "").toLowerCase();
        if (managementRoles.includes(nextRole)) setRole(nextRole);
      } catch {
        /* The protected destination handles authentication errors. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible]);

  useEffect(() => {
    if (!eligible || !role) return;
    document.body.classList.add("spf-admin-nav-active");
    return () => {
      document.body.classList.remove("spf-admin-nav-active");
    };
  }, [eligible, role]);

  if (!eligible || !role) return null;
  return (
    <AdminChrome
      role={role}
      active={pathname.startsWith("/reception-member/") ? "/admin-members" : pathname}
    />
  );
}
