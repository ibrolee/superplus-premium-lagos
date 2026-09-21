import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, RefreshCw, ShieldCheck, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";

export const Route = createFileRoute("/admin-workspace")({ component: AdminWorkspace });
type Payment = { id: string; amount: number | null; status: string | null; paid_at: string | null; created_at: string; metadata: Record<string, unknown> | null };
type Revenue = { today: number; month: number; total: number; transactions: number; baseline: string };
const money = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
function lagosDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
async function readRevenue(): Promise<Revenue> {
  const { data: baseline, error: baselineError } = await supabase.rpc("admin_revenue_baseline");
  if (baselineError) throw baselineError;
  if (typeof baseline !== "string" || !Number.isFinite(Date.parse(baseline))) throw new Error("Revenue baseline is unavailable. Open the original report.");
  const today = lagosDay(new Date());
  const cutoff = Date.parse(baseline);
  let todayTotal = 0, monthTotal = 0, total = 0, transactions = 0;
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc("admin_revenue_rows")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    const batch = (data || []) as Payment[];
    for (const payment of batch) {
      const date = payment.paid_at || payment.created_at;
      const amount = Number(payment.amount);
      if (payment.status?.toLowerCase() !== "success" || payment.metadata?.["revenue_excluded"] === true || payment.metadata?.["record_type"] === "historical_import" ||
        !date || !Number.isFinite(Date.parse(date)) || Date.parse(date) < cutoff || !Number.isFinite(amount)) continue;
      const day = lagosDay(new Date(date));
      total += amount;
      transactions += 1;
      if (day === today) todayTotal += amount;
      if (day.slice(0, 7) === today.slice(0, 7)) monthTotal += amount;
    }
    if (batch.length < 500) return { today: todayTotal, month: monthTotal, total, transactions, baseline };
  }
}

const actions = [
  { label: "Approval inbox", description: "Review pending reception collections, member claims and staff requests.", href: "/admin-approvals", icon: ShieldCheck },
  { label: "Members directory", description: "Find members and review their profiles.", href: "/admin-members", icon: Users },
  { label: "Staff oversight", description: "View staff records and attendance reports.", href: "/management-staff", icon: Users },
  { label: "Attendance reports", description: "Review member visits without opening the QR scanner.", href: "/management-attendance", icon: CalendarDays },
];
function AdminWorkspace() {
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(""); setRevenue(null);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through the admin portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) throw new Error("Only management can view revenue.");
        const result = await readRevenue();
        if (!cancelled) setRevenue(result);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load verified revenue."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [reload]);
  const cards = useMemo(() => revenue ? [
    { label: "Revenue today", value: money(revenue.today), note: "Successful payments · Lagos time" },
    { label: "This month", value: money(revenue.month), note: "Since the start of this month" },
    { label: "Recorded revenue", value: money(revenue.total), note: "Since the protected reporting baseline" },
    { label: "Transactions", value: revenue.transactions.toLocaleString("en-NG"), note: "Verified successful records" },
  ] : [], [revenue]);
  return <AdminWorkspaceShell title="Dashboard" subtitle="Financial oversight, approvals and management reports." active="/admin-workspace">
    <section aria-labelledby="financial-heading" className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#65905c]">01 / Finance</p><h2 id="financial-heading" className="mt-1 text-2xl font-black">Financial overview</h2></div><button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] px-4 py-2.5 text-xs font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
      {loading && <p role="status" className="mt-6 rounded-xl bg-[#f4f6f1] p-5 text-sm text-[#637469]">Checking management access and loading revenue…</p>}
      {!loading && error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} Revenue is unavailable, not zero. <a href="/management-revenue" className="font-bold underline">Open the full report</a>.</p>}
      {!loading && revenue && <><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <article key={card.label} className="min-w-0 rounded-2xl border border-[#dce8d9] bg-[#f8faf6] p-5"><p className="text-sm font-semibold text-[#5f7463]">{card.label}</p><p className="mt-3 break-words text-2xl font-black tabular-nums sm:text-3xl">{card.value}</p><p className="mt-2 text-xs text-[#657568]">{card.note}</p></article>)}</div><p className="mt-4 text-xs leading-5 text-[#657568]">Only successful payments after the database reporting baseline are counted. Historical imports and explicitly excluded records are not included. Your original records remain unchanged.</p></>}
      <div className="mt-5 flex flex-wrap gap-3"><a href="/management-revenue" className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white">Full revenue report <ArrowRight size={17}/></a><a href="/admin-approvals" className="inline-flex items-center gap-2 rounded-xl border border-[#ccd8cb] px-5 py-3 text-sm font-bold text-[#193b2a]">Approval inbox <ArrowRight size={17}/></a></div>
    </section>
    <section aria-labelledby="actions-heading" className="mt-8"><p className="text-xs font-black uppercase tracking-[.15em] text-[#65905c]">02 / Management</p><h2 id="actions-heading" className="mt-1 text-2xl font-black">Management shortcuts</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{actions.map(({ label, description, href, icon: Icon }) => <a key={label} href={href} className="group flex items-start gap-4 rounded-[20px] border border-[#e1e8dd] bg-white p-5 hover:border-[#9cbb92]"><span className="rounded-xl bg-[#edf6e7] p-3 text-[#38673e]"><Icon size={21}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-[#657568]">{description}</span></span><ArrowRight size={17} className="shrink-0 text-[#4b7650]"/></a>)}</div></section>
    <section className="mt-8 rounded-2xl border border-[#dce8d9] bg-[#edf6e7] p-5 text-xs leading-6 text-[#536f55]"><div className="flex items-start gap-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0"/><p>Reception submissions and QR scanning belong in the separate Reception Dashboard. Managers review requests here only after independent verification; the admin dashboard does not alter payment status, member activation or database permissions.</p></div></section>
  </AdminWorkspaceShell>;
}
