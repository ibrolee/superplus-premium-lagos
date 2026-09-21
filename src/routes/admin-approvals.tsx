import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin-approvals")({ component: AdminApprovals });

type QueueKey = "payments" | "intake" | "returning" | "accounts" | "missed";
type Queue = { key: QueueKey; title: string; description: string; table: "fitness_payment_requests" | "fitness_new_member_requests" | "fitness_returning_member_claims" | "staff_profiles" | "staff_missed_scan_requests"; fields: string; order: string; href: string; nextStep: string; roles: string[] };
type QueueState = { count: number | null; examples: string[]; error: string | null };

const queues: Queue[] = [
  { key: "payments", title: "Payment requests", description: "Reception collections awaiting independent verification. Pending requests are not revenue or active memberships.", table: "fitness_payment_requests", fields: "id,receipt_number,amount,submitted_at", order: "submitted_at", href: "/management-payment-desk#approvals", nextStep: "Open the desk and select Management approvals to review a payment.", roles: ["admin", "owner", "manager"] },
  { key: "intake", title: "New-member registrations", description: "Pending walk-in registrations requiring independent verification before a profile, payment or plan is created.", table: "fitness_new_member_requests", fields: "id,receipt_number,full_name,submitted_at", order: "submitted_at", href: "/management-new-member-intake#review", nextStep: "Open the intake desk and select Manager reviews.", roles: ["admin", "owner", "manager"] },
  { key: "returning", title: "Returning-member claims", description: "Reception requests to recognise an existing member. Approval does not record a payment or activate a plan.", table: "fitness_returning_member_claims", fields: "id,full_name,submitted_at", order: "submitted_at", href: "/management-payment-desk#approvals", nextStep: "Open the desk, select Management approvals and find Returning-member claims.", roles: ["admin", "owner"] },
  { key: "accounts", title: "Staff account requests", description: "New staff profiles awaiting account review and authorisation.", table: "staff_profiles", fields: "id,full_name,created_at", order: "created_at", href: "/staff-admin#staff", nextStep: "Open the original admin page, expand Staff Management and review pending profiles.", roles: ["admin"] },
  { key: "missed", title: "Missed-scan requests", description: "Staff explanations for missing attendance QR scans. Approval does not change recorded hours or salary.", table: "staff_missed_scan_requests", fields: "id,work_date,kind,created_at", order: "created_at", href: "/staff-missed-scans", nextStep: "Open the staff request queue to approve or reject requests.", roles: ["admin"] },
];

function describe(row: Record<string, unknown>, key: QueueKey): string {
  if (key === "payments") return `${String(row["receipt_number"] || "Payment request")} · ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(row["amount"] || 0))}`;
  if (key === "intake") return `${String(row["receipt_number"] || "New registration")} · ${String(row["full_name"] || "Unnamed member")}`;
  if (key === "returning" || key === "accounts") return String(row["full_name"] || "Unnamed applicant");
  return `${String(row["work_date"] || "Date unknown")} · ${String(row["kind"] || "Missed scan").replaceAll("_", " ")}`;
}

function AdminApprovals() {
  const [role, setRole] = useState("");
  const [items, setItems] = useState<Record<string, QueueState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setItems({}); setError(""); setRole("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through the admin portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        const nextRole = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["admin", "owner", "manager"].includes(nextRole)) throw new Error("An active management account is required to view approval requests.");
        if (cancelled) return;
        setRole(nextRole);
        const results = await Promise.all(queues.filter((queue) => queue.roles.includes(nextRole)).map(async (queue) => {
          try {
            const { data, error: queueError, count } = await supabase.from(queue.table).select(queue.fields, { count: "exact" })
              .eq("status", "pending").order(queue.order, { ascending: false }).limit(3);
            if (queueError) throw queueError;
            return [queue.key, { count, examples: (data || []).map((row) => describe(row as unknown as Record<string, unknown>, queue.key)), error: null }] as const;
          } catch (cause) {
            return [queue.key, { count: null, examples: [], error: cause instanceof Error ? cause.message : "Queue unavailable." }] as const;
          }
        }));
        if (!cancelled) setItems(Object.fromEntries(results));
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to check approval access."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [revision]);

  const visible = queues.filter((queue) => queue.roles.includes(role));
  const known = visible.every((queue) => items[queue.key]?.count !== null && items[queue.key]?.count !== undefined);
  const pending = known ? visible.reduce((sum, queue) => sum + (items[queue.key]?.count || 0), 0) : null;

  return <AdminWorkspaceShell title="Approvals" subtitle="Review reception submissions and staff requests in one place." active="/admin-approvals">
    <section className="mt-7 rounded-[24px] border border-[#dce8d9] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#65905c]">Management inbox</p><h2 className="mt-2 text-2xl font-black">Pending requests: {loading ? "Loading…" : pending === null ? "Unavailable" : pending}</h2><p className="mt-2 text-sm text-[#627468]">Counts show current pending records, not payments collected or approvals completed.</p></div><button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
      {loading && <p className="mt-5 text-sm" role="status">Checking permissions and loading approval queues…</p>}
      {!loading && error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    </section>
    {!loading && !error && <div className="mt-5 grid gap-4 lg:grid-cols-2">{visible.map((queue) => {
      const state = items[queue.key];
      return <section key={queue.key} className="rounded-[22px] border border-[#dce8d9] bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-widest text-[#68905d]">Review queue</p><h3 className="mt-2 text-xl font-black">{queue.title}</h3></div><span className="rounded-xl bg-[#edf6e7] px-3 py-2 text-lg font-black tabular-nums text-[#193b2a]">{state?.count === null || state?.count === undefined ? "—" : state.count}</span></div>
        <p className="mt-3 text-sm leading-6 text-[#637469]">{queue.description}</p>
        {state?.error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">This queue could not be loaded: {state.error}. No zero count is assumed.</p>}
        {!state?.error && !!state?.examples.length && <div className="mt-4 rounded-xl bg-[#f4f6f1] p-4"><p className="mb-2 text-xs font-black uppercase tracking-wide text-[#526b57]">Most recent pending</p>{state.examples.map((example, index) => <p key={`${queue.key}-${index}`} className="border-b border-[#dde6d9] py-2 text-sm last:border-0">{example}</p>)}</div>}
        {!state?.error && state?.count === 0 && <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#526b57]"><CheckCircle2 size={16}/> No pending requests.</p>}
        <p className="mt-4 text-xs leading-5 text-[#667769]">{queue.nextStep}</p>
        <a href={queue.href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white">Open review <ArrowRight size={16}/></a>
      </section>;
    })}</div>}
    <p className="mt-7 flex items-start gap-2 rounded-xl border border-[#dce8d9] bg-[#edf6e7] p-5 text-xs leading-6 text-[#536f55]"><ShieldCheck size={18} className="mt-1 shrink-0"/> Approvals still take place in the existing protected review pages. A separate authorised person must verify collected funds; no self-approval, automatic revenue recording or membership activation is performed by this inbox.</p>
  </AdminWorkspaceShell>;
}
