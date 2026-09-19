import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Loader2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-revenue")({ component: ManagementRevenue });
type Payment = {
  id: string; amount: number | null; currency: string | null; status: string | null;
  payment_method: string | null; provider: string | null; paystack_reference: string | null;
  paid_at: string | null; created_at: string; metadata: Record<string, unknown> | null;
};
type Source = "all" | "website" | "cash" | "pos" | "bank_transfer" | "other";
type Period = "today" | "week" | "month" | "all";
const PAGE_SIZE = 500;
const LIST_SIZE = 20;
const LAGOS = "Africa/Lagos";
function dayInLagos(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (kind: string) => parts.find((p) => p.type === kind)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function weekStart(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}
function paymentDate(payment: Payment) { return payment.paid_at || payment.created_at; }
function formatMoney(value: number) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") : "";
}
// Same source priorities as the existing administrator revenue report.
function sourceOf(payment: Payment): Exclude<Source, "all"> {
  const meta = payment.metadata || {};
  const candidates = [payment.payment_method, payment.provider, meta["payment_method"], meta["payment_source"], meta["provider"]].map(normalize);
  if (candidates.some((item) => ["paystack", "online", "online payment", "website", "card", "card payment"].includes(item))) return "website";
  if (candidates.includes("cash")) return "cash";
  if (candidates.includes("pos") || candidates.includes("point of sale")) return "pos";
  if (candidates.includes("bank transfer") || candidates.includes("bank")) return "bank_transfer";
  return "other";
}
const sourceLabels: Record<Source, string> = { all: "All sources", website: "Website", cash: "Cash", pos: "POS", bank_transfer: "Bank Transfer", other: "Other" };
function planOf(payment: Payment) {
  const plan = payment.metadata?.["plan_name"];
  return typeof plan === "string" && plan.trim() ? plan : "Membership payment";
}
async function loadCanonicalPayments(): Promise<{ baseline: string; payments: Payment[] }> {
  const { data: baseline, error: baselineError } = await supabase.rpc("admin_revenue_baseline");
  if (baselineError) throw baselineError;
  if (typeof baseline !== "string" || !Number.isFinite(Date.parse(baseline))) throw Error("Revenue baseline is unavailable. Check the original administrator report.");
  const all: Payment[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.rpc("admin_revenue_rows")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Payment[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  const cutoff = Date.parse(baseline);
  return { baseline, payments: all.filter((payment) => {
    const date = paymentDate(payment);
    return payment.status?.toLowerCase() === "success" && payment.metadata?.["revenue_excluded"] !== true &&
      payment.metadata?.["record_type"] !== "historical_import" && !!date && Date.parse(date) >= cutoff &&
      Number.isFinite(Number(payment.amount));
  }) };
}
function ManagementRevenue() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [baseline, setBaseline] = useState("");
  const [reload, setReload] = useState(0);
  const [period, setPeriod] = useState<Period>("month");
  const [source, setSource] = useState<Source>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const today = dayInLagos(new Date());
  const monday = weekStart(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setAuthorized(false); setPayments([]); setBaseline("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the Staff Portal to view revenue.");
        const { data: staff, error: staffError } = await supabase.from("staff_users")
          .select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) {
          throw Error("Only active management accounts can view the revenue report.");
        }
        const result = await loadCanonicalPayments();
        if (!cancelled) { setPayments(result.payments); setBaseline(result.baseline); setAuthorized(true); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load revenue records."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);
  const sourcePayments = useMemo(() => payments.filter((payment) => source === "all" || sourceOf(payment) === source), [payments, source]);
  const selected = useMemo(() => sourcePayments.filter((payment) => {
    const day = dayInLagos(new Date(paymentDate(payment)));
    return period === "all" || (period === "today" && day === today) || (period === "week" && day >= monday) || (period === "month" && day >= monthStart);
  }), [sourcePayments, period, today, monday, monthStart]);
  const total = selected.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const todayTotal = sourcePayments.filter((payment) => dayInLagos(new Date(paymentDate(payment))) === today).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const monthTotal = sourcePayments.filter((payment) => dayInLagos(new Date(paymentDate(payment))) >= monthStart).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const breakdown = useMemo(() => (Object.keys(sourceLabels) as Source[]).filter((item) => item !== "all")
    .map((item) => ({ source: item, amount: selected.filter((payment) => sourceOf(payment) === item).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) })), [selected]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return selected.filter((payment) => !needle || [payment.paystack_reference, planOf(payment), payment.payment_method, payment.provider, sourceLabels[sourceOf(payment)]]
      .some((field) => String(field || "").toLowerCase().includes(needle)))
      .sort((a, b) => Date.parse(paymentDate(b)) - Date.parse(paymentDate(a)) || b.id.localeCompare(a.id));
  }, [selected, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * LIST_SIZE, currentPage * LIST_SIZE);
  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><a href="/management-operations" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Operations hub</a><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">Super Plus / Management</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Revenue report</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">Management-only, read-only figures from your existing revenue reporting functions. Lagos reporting dates.</p></div><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]"><Loader2 size={20} className="animate-spin"/> Verifying management access and loading the full revenue ledger…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
    {!loading && authorized && <>
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]"><ShieldCheck className="mt-0.5 shrink-0" size={20}/><p><strong>Historical revenue protected.</strong> Uses the database-owned reporting baseline, excludes historical imports and explicitly excluded payments, and counts successful transactions only. This view cannot edit payments or reset your totals. Compare with your original admin report before relying on it for accounting.</p></div>
      <section aria-label="Revenue filters" className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Reporting period</h2><span className="text-xs text-[#748276]">Baseline: {formatDate(baseline)}</span></div><div className="mt-4 flex flex-wrap gap-2">{([ ["today","Today"], ["week","This week"], ["month","This month"], ["all","All since baseline"] ] as [Period,string][]).map(([value,label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => { setPeriod(value); setPage(1); }} className={`rounded-full px-4 py-2.5 text-xs font-bold ${period === value ? "bg-[#193d2b] text-white" : "border border-[#dbe6d7] bg-[#f8faf6] text-[#526b57]"}`}>{label}</button>)}</div><p className="mt-6 text-xs font-black uppercase tracking-wider text-[#617567]">Payment source</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(sourceLabels) as Source[]).map((value) => <button key={value} type="button" aria-pressed={source === value} onClick={() => { setSource(value); setPage(1); }} className={`rounded-full px-4 py-2.5 text-xs font-bold ${source === value ? "bg-[#193d2b] text-white" : "border border-[#dbe6d7] bg-[#f8faf6] text-[#526b57]"}`}>{sourceLabels[value]}</button>)}</div></section>
      <section aria-label="Revenue summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        { title: "Selected revenue", value: formatMoney(total), note: "Chosen period and source", icon: Wallet },
        { title: "Today's revenue", value: formatMoney(todayTotal), note: "Chosen source", icon: CreditCard },
        { title: "This month's revenue", value: formatMoney(monthTotal), note: "Chosen source", icon: Wallet },
        { title: "Transactions", value: selected.length.toLocaleString("en-NG"), note: "Successful payments in selection", icon: CheckCircle2 },
      ].map(({title,value,note,icon:Icon}) => <div key={title} className="min-w-0 rounded-[22px] border border-[#e1e8dd] bg-white p-5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#627468]">{title}</span><Icon size={19} className="shrink-0 text-[#3b6b38]"/></div><p className="mt-5 break-words text-2xl font-black tabular-nums sm:text-3xl">{value}</p><p className="mt-2 text-xs text-[#748276]">{note}</p></div>)}</section>
      <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Revenue by source</h2><a href="/staff-admin#revenue-panel" className="inline-flex items-center gap-2 text-xs font-bold text-[#356942]">Original admin report <ArrowRight size={15}/></a></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{breakdown.map((item) => <div key={item.source} className="rounded-xl border border-[#e2e9dd] bg-[#f8faf6] p-4"><p className="text-xs font-bold text-[#607465]">{sourceLabels[item.source]}</p><p className="mt-2 text-xl font-black tabular-nums">{formatMoney(item.amount)}</p></div>)}</div></section>
      <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Successful transactions</h2><p className="mt-1 text-xs text-[#748276]">{filtered.length} matching payments · {selected.length} in selected period · read-only</p></div><label className="min-w-0"><span className="sr-only">Search reference, plan, method or provider</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search reference, plan or method" className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-sm outline-none focus:border-[#63915f] sm:w-72"/></label></div><div className="mt-5 divide-y divide-[#e7ede4]">{visible.map((payment) => <div key={payment.id} className="flex flex-wrap items-center gap-3 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef6e8] text-[#38673e]"><CreditCard size={18}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{planOf(payment)}</p><p className="mt-1 text-xs text-[#718172]">{sourceLabels[sourceOf(payment)]} · {formatDate(paymentDate(payment))}</p><p className="mt-1 break-all font-mono text-[11px] text-[#809080]">{payment.paystack_reference || payment.id}</p></div><strong className="text-sm tabular-nums sm:text-base">{formatMoney(Number(payment.amount || 0))}</strong></div>)}{visible.length === 0 && <p className="py-10 text-center text-sm text-[#748276]">No successful payments match the current filters.</p>}</div><div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="text-xs text-[#748276]">{currentPage} / {totalPages}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((n) => n + 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40">Next <ChevronRight size={16}/></button></div></section>
    </>}
  </div></main>;
}
