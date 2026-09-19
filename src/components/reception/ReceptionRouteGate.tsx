import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const RECEPTION_ROLES = new Set(["reception", "admin", "owner", "manager"]);

type AccessState = {
  path: string;
  revision: number;
  status: "checking" | "allowed" | "signed-out" | "denied";
};

/**
 * Client-side page guard for the original reception routes, which previously
 * checked only that an active staff_users row existed, irrespective of role.
 * This prevents the protected page components (and their member queries) from
 * mounting before access is checked. Supabase RLS must be verified separately:
 * a browser route guard does not secure direct database/API requests.
 */
export function ReceptionRouteGate() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const guarded = path === "/reception-dashboard" || path === "/reception-checkin" ||
    path.startsWith("/reception-member/");
  const [revision, setRevision] = useState(0);
  const [access, setAccess] = useState<AccessState>({ path: "", revision: -1, status: "checking" });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setRevision((previous) => previous + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!guarded) return;
    let cancelled = false;
    setAccess({ path, revision, status: "checking" });
    async function verify() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (!cancelled) setAccess({ path, revision, status: "signed-out" });
          return;
        }
        const { data: staff, error: staffError } = await supabase.from("staff_users")
          .select("role,active").eq("auth_user_id", data.user.id).maybeSingle();
        if (!cancelled) setAccess({
          path,
          revision,
          status: !staffError && staff?.active && RECEPTION_ROLES.has(String(staff.role || "").toLowerCase())
            ? "allowed" : "denied",
        });
      } catch {
        if (!cancelled) setAccess({ path, revision, status: "denied" });
      }
    }
    void verify();
    return () => { cancelled = true; };
  }, [path, guarded, revision]);

  if (!guarded) return <Outlet />;
  if (access.path !== path || access.revision !== revision || access.status === "checking") {
    return <main role="status" className="mx-auto min-h-[55vh] max-w-3xl px-5 py-16 text-sm">Checking reception access…</main>;
  }
  if (access.status === "allowed" || (access.status === "signed-out" && path === "/reception-checkin")) {
    // Keep the original scanner's staff sign-in form accessible to signed-out users.
    return <Outlet />;
  }
  return <main className="mx-auto min-h-[55vh] max-w-3xl px-5 py-16">
    <div role="alert" className="rounded-2xl border border-[#d8e2d5] bg-white p-6 text-[#193327]">
      <h1 className="text-2xl font-black">Reception access required</h1>
      <p className="mt-3 text-sm leading-6">{access.status === "signed-out"
        ? "Sign in with an authorised reception or management account to access member records."
        : "Your account does not have reception access. Contact management if you need this permission."}</p>
      <a href="/staff" className="mt-5 inline-flex rounded-xl bg-[#193327] px-5 py-3 text-sm font-bold text-white">Go to staff portal</a>
    </div>
  </main>;
}
