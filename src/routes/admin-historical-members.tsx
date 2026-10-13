import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, History, ShieldCheck } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { HistoricalMemberManager } from "@/components/admin/HistoricalMemberManager";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin-historical-members")({
  component: AdminHistoricalMembers,
});

type Access = "checking" | "allowed" | "denied";

function AdminHistoricalMembers() {
  const [access, setAccess] = useState<Access>("checking");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in as an administrator to continue.");

        const { data: staff, error: staffError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || String(staff.role || "").toLowerCase() !== "admin") {
          throw new Error("Only active administrators can manage historical member imports.");
        }

        if (!cancelled) setAccess("allowed");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to verify administrator access.");
          setAccess("denied");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminWorkspaceShell
      title="Historical members"
      subtitle="Recognise previous members and activate memberships paid before the current reporting period."
      active="/admin-historical-members"
    >
      <section className="mt-7 overflow-hidden rounded-[24px] border border-[#dbe6d9] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-[#193b2a] px-5 py-6 text-white sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#b8ee73] text-[#193b2a]">
              <History size={22} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#b8ee73]">Legacy records</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Historical member management</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d5e5d6]">
                Import a previous member, recognise an earlier payment or activate a membership already paid for.
              </p>
            </div>
          </div>
          <a
            href="/admin-members"
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20"
          >
            Member directory <ArrowRight size={15} />
          </a>
        </div>
        <div className="flex items-start gap-3 px-5 py-4 text-sm leading-6 text-[#506b59] sm:px-7">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#348059]" />
          <p>Historical imports stay outside current revenue totals. Existing payment history is preserved. Use the normal payment flow for money collected today.</p>
        </div>
      </section>

      {access === "checking" && (
        <p role="status" className="mt-5 rounded-2xl border border-[#dbe6d9] bg-white p-5 text-sm text-[#506b59]">
          Checking administrator access...
        </p>
      )}
      {access === "denied" && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error}
        </p>
      )}
      {access === "allowed" && (
        <div className="mt-5">
          <HistoricalMemberManager
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((current) => current + 1)}
            initiallyOpen
          />
        </div>
      )}
    </AdminWorkspaceShell>
  );
}
