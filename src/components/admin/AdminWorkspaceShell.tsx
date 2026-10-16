import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { usePageAdminNavigation } from "./AdminNavigationContext";
import { AdminChrome } from "./AdminChrome";
export { adminGroups, canSeeAdminTool } from "./admin-tools";

export function AdminWorkspaceShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active: string;
  children: ReactNode;
}) {
  usePageAdminNavigation();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the admin portal.");
        const { data: staff, error } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (error) throw error;
        const next = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["admin", "owner", "manager"].includes(next))
          throw Error("An active management account is required.");
        if (!cancelled) setRole(next);
      } catch (cause) {
        if (!cancelled)
          setAccessError(cause instanceof Error ? cause.message : "Unable to check access.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking)
    return (
      <main role="status" className="min-h-screen bg-[var(--portal-canvas)] p-8 text-sm">
        Checking management access…
      </main>
    );
  if (!role)
    return (
      <main className="min-h-screen bg-[var(--portal-canvas)] p-8">
        <div
          role="alert"
          className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-7 text-red-800"
        >
          {accessError || "Access denied."}{" "}
          <a href="/portal/admin" className="font-bold underline">
            Admin sign-in
          </a>
        </div>
      </main>
    );
  return (
    <div className="spf-admin-workspace min-h-screen bg-[var(--portal-canvas)] text-[color:var(--portal-ink)]">
      <AdminChrome role={role} active={active} />
      <main
        id="admin-main"
        className="spf-admin-page mx-auto w-full min-w-0 max-w-[1500px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8"
      >
        <p className="text-[10px] font-black uppercase tracking-[.17em] text-[color:var(--portal-accent)]">
          Super Plus / Admin
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--portal-muted)]">
            {subtitle}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
