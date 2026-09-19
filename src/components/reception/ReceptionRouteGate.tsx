import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Access = { path: string; revision: number; state: "checking" | "allowed" | "signed-out" | "denied" };
const receptionRoles = new Set(["reception", "admin", "owner", "manager"]);
export function ReceptionRouteGate() {
  const path = useRouterState({ select: state => state.location.pathname });
  const employeeRoute = path === "/staff";
  const receptionRoute = path === "/reception-checkin" || path.startsWith("/reception-member/");
  const guarded = employeeRoute || receptionRoute;
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<Access>({ path: "", revision: -1, state: "checking" });
  useEffect(() => { const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) setRevision(value => value + 1); }); return () => subscription.unsubscribe(); }, []);
  useEffect(() => {
    if (!guarded) return;
    let cancelled = false; setAccess({ path, revision, state: "checking" });
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) { if (!cancelled) setAccess({ path, revision, state: "signed-out" }); return; }
        const { data: accessRow, error: accessError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", data.user.id).maybeSingle();
        if (accessError) throw accessError;
        const role = String(accessRow?.role || "").toLowerCase();
        if (receptionRoute) { if (!cancelled) setAccess({ path, revision, state: accessRow?.active && receptionRoles.has(role) ? "allowed" : "denied" }); return; }
        // Employees have their own portal. A legacy employee profile must not
        // grant reception/admin account access to employee features.
        if (accessRow?.active && receptionRoles.has(role)) { if (!cancelled) setAccess({ path, revision, state: "denied" }); return; }
        const { data: staff, error: staffError } = await supabase.from("staff_profiles").select("id,status").eq("auth_user_id", data.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!cancelled) setAccess({ path, revision, state: staff && ["approved", "pending"].includes(staff.status) ? "allowed" : "denied" });
      } catch { if (!cancelled) setAccess({ path, revision, state: "denied" }); }
    })();
    return () => { cancelled = true; };
  }, [path, guarded, revision, receptionRoute]);
  if (!guarded) return <Outlet/>;
  if (access.path !== path || access.revision !== revision || access.state === "checking") return <main role="status" className="mx-auto min-h-[55vh] max-w-3xl px-5 py-16 text-sm">Checking account access…</main>;
  if (access.state === "allowed") return <Outlet/>;
  const portal = employeeRoute ? "/portal/staff" : "/portal/reception";
  return <main className="mx-auto min-h-[55vh] max-w-3xl px-5 py-16"><div role="alert" className="rounded-2xl border border-[#d8e2d5] bg-white p-6 text-[#193327]"><h1 className="text-2xl font-black">{employeeRoute ? "Employee access required" : "Reception access required"}</h1><p className="mt-3 text-sm leading-6">{access.state === "signed-out" ? "Sign in through your dedicated portal to continue." : "This account is not assigned to this portal. Choose the correct login or contact management."}</p><a href={portal} className="mt-5 inline-flex rounded-xl bg-[#193327] px-5 py-3 text-sm font-bold text-white">Open {employeeRoute ? "staff" : "reception"} portal</a><a href="/portal" className="ml-4 inline-flex py-3 text-sm font-bold underline">All portals</a></div></main>;
}
