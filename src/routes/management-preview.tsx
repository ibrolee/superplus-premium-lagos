import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, Clock3, CreditCard, LayoutDashboard, Loader2, RefreshCw, Search, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-preview")({ component: ManagementPreview });
type Membership = { member_id: string; start_date: string | null; end_date: string | null; status: string | null };
type Visit = { member_id: string; checked_in_at: string | null; checked_out_at: string | null };
type Member = { id: string; full_name: string | null; phone: string | null };
type Payment = { id: string; amount: number | null; status: string | null; paid_at: string | null; created_at: string; metadata: Record<string, unknown> | null };
type Metrics = { memberCount: number; activeCount: number; expiringCount: number; todayVisits: number; insideCount: number; visitsByDay: { date: string; label: string; count: number }[] };
type Revenue = { today: number; month: number; total: number; transactions: number };
type Access = { role: string; management: boolean };

function lagosDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftDate(date: string, days: number) {
  const noon = new Date(`${date}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}
function money(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}
function validMembership(m: Membership, day: string) {
  return m.status?.toLowerCase() !== "paused" && m.status?.toLowerCase() !== "cancelled" && !!m.start_date && !!m.end_date && m.start_date.slice(0, 10) <= day && m.end_date.slice(0, 10) >= day;
}
function number(value: number | undefined) {
  return typeof value === "number" ? new Intl.NumberFormat("en-NG").format(value) : "—";
}
async function fetchAllMemberships(): Promise<Membership[]> {
  const result: Membership[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("memberships").select("member_id,start_date,end_date,status").order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    const batch = (data || []) as Membership[];
    result.push(...batch);
    if (batch.length < 500) return result;
  }
}
async function fetchRecentAttendance(since: string): Promise<Visit[]> {
  const result: Visit[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("attendance").select("member_id,checked_in_at,checked_out_at").gte("checked_in_at", `${since}T00:00:00+01:00`).order("checked_in_at", { ascending: true }).order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    const batch = (data || []) as Visit[];
    result.push(...batch);
    if (batch.length < 500) return result;
  }
}
async function fetchRevenue(today: string): Promise<Revenue> {
  const { data: baseline, error: baselineError } = await supabase.rpc("admin_revenue_baseline");
  if (baselineError || typeof baseline !== "string" || !Number.isFinite(Date.parse(baseline))) throw new Error(baselineError?.message || "Revenue baseline unavailable. Use the existing Revenue Report for details.");
  let total = 0, todayAmount = 0, monthAmount = 0, transactions = 0;
  const cutoff = Date.parse(baseline);
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.rpc("admin_revenue_rows").order("created_at", { ascending: true }).order("id", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    const batch = (data || []) as Payment[];
    for (const payment of batch) {
      const when = payment.paid_at || payment.created_at;
      if (payment.status?.toLowerCase() !== "success" || payment.metadata?.["revenue_excluded"] === true || payment.metadata?.["record_type"] === "historical_import" || !when || Date.parse(when) < cutoff) continue;
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount)) continue;
      total += amount;
      transactions += 1;
      const day = lagosDate(new Date(when));
      if (day === today) todayAmount += amount;
      if (day.slice(0, 7) === today.slice(0, 7)) monthAmount += amount;
    }
    if (batch.length < 500) return { today: todayAmount, month: monthAmount, total, transactions };
  }
}

function ManagementPreview() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [revenueError, setRevenueError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const today = lagosDate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setRevenueError(""); setMetrics(null); setRevenue(null); setAccess(null);
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData.user) throw new Error("Sign in through the Staff Portal to view this dashboard.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", userData.user.id).maybeSingle();
        if (staffError) throw staffError;
        const role = String(staff?.role || "").toLowerCase();
        const management = ["admin", "owner", "manager"].includes(role);
        if (!staff?.active || (!management && role !== "reception")) throw new Error("Only active reception and management accounts can access this preview.");
        if (cancelled) return;
        setAccess({ role, management });
        const [{ count, error: countError }, memberships, visits] = await Promise.all([
          supabase.from("members").select("id", { count: "exact", head: true }),
          fetchAllMemberships(), fetchRecentAttendance(shiftDate(today, -6)),
        ]);
        if (countError) throw countError;
        const activeMemberships = memberships.filter((m) => validMembership(m, today));
        const active = new Set(activeMemberships.map((m) => m.member_id));
        const latestExpiry = new Map<string, string>();
        for (const membership of activeMemberships) {
          const end = membership.end_date!.slice(0, 10);
          if (end > (latestExpiry.get(membership.member_id) || "")) latestExpiry.set(membership.member_id, end);
        }
        const inSevenDays = shiftDate(today, 7);
        const expiringCount = [...latestExpiry.values()].filter((end) => end <= inSevenDays).length;
        const visitsToday = visits.filter((v) => !!v.checked_in_at && lagosDate(new Date(v.checked_in_at)) === today);
        const visitDays = Array.from({ length: 7 }, (_, i) => {
          const date = shiftDate(today, i - 6);
          return { date, label: new Intl.DateTimeFormat("en-NG", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)), count: new Set(visits.filter((v) => v.checked_in_at && lagosDate(new Date(v.checked_in_at)) === date).map((v) => v.member_id)).size };
        });
        if (!cancelled) setMetrics({ memberCount: count || 0, activeCount: active.size, expiringCount, todayVisits: new Set(visitsToday.map((v) => v.member_id)).size, insideCount: new Set(visitsToday.filter((v) => !v.checked_out_at).map((v) => v.member_id)).size, visitsByDay: visitDays });
        if (management) {
          try { const sums = await fetchRevenue(today); if (!cancelled) setRevenue(sums); }
          catch (err) { if (!cancelled) setRevenueError(err instanceof Error ? err.message : "Unable to load revenue."); }
        }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh, today]);

  async function searchMembers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearched(true); setSearching(true); setResults([]);
    try {
      const term = query.trim().replace(/[%_,()]/g, " ").trim();
      if (term.length < 2) { setError("Enter at least two characters to search members."); return; }
      setError("");
      const { data, error: searchError } = await supabase.from("members").select("id,full_name,phone").or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`).order("full_name", { ascending: true }).limit(15);
      if (searchError) throw searchError;
      setResults((data || []) as Member[]);
    } catch (err) { setError(err instanceof Error ? err.message : "Member search failed."); }
    finally { setSearching(false); }
  }

  const maximumVisits = useMemo(() => Math.max(1, ...(metrics?.visitsByDay.map((d) => d.count) || [1])), [metrics]);
  const statCards = [
    { label: "Total members", value: number(metrics?.memberCount), sub: "Registered profiles", icon: Users },
    { label: "Active members", value: number(metrics?.activeCount), sub: "Current valid memberships", icon: CheckCircle2 },
    { label: "Visits today", value: number(metrics?.todayVisits), sub: "Unique members · Lagos time", icon: Activity },
    { label: "Inside right now", value: number(metrics?.insideCount), sub: "Today's open check-ins", icon: Clock3 },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f1] text-[#16221c]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col lg:flex-row">
        <aside className="border-b border-[#243b32] bg-[#152820] px-5 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:px-6 lg:py-8">
          <a href="/" className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8ee73] font-black text-[#193327]">S+</div><div><p className="text-sm font-black tracking-wide">SUPER PLUS</p><p className="text-[10px] uppercase tracking-[.26em] text-[#b9c9be]">Fitness management</p></div></a>
          <div className="mt-7 hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#96ad9b] lg:block">Workspace</div>
          <nav aria-label="Management navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            <a href="#overview" className="flex shrink-0 items-center gap-3 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#183125]"><LayoutDashboard size={17} /> Overview</a>
            <a href="#members" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Users size={17} /> Members</a>
            <a href="#attendance" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Activity size={17} /> Attendance</a>
            {access?.management && <a href="#revenue" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Wallet size={17} /> Revenue</a>}
          </nav>
          <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block"><ShieldCheck size={20} className="text-[#b8ee73]" /><p className="mt-3 text-sm font-semibold">Preview workspace</p><p className="mt-1 text-xs leading-5 text-[#b9c9be]">Read-only overview. Registration, scanning and payroll remain in your existing tools.</p></div>
          <a href="/staff" className="mt-4 hidden text-xs text-[#b9c9be] underline-offset-4 hover:underline lg:block">← Staff portal</a>
        </aside>
        <main id="overview" className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#5f7b68]">Super Plus / Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{access?.management ? "Management overview" : "Reception overview"}</h1><p className="mt-2 text-sm text-[#637469]">Live operational data · {new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date())}</p></div><button type="button" onClick={() => setRefresh((count) => count + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:border-[#72976f] disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button></div>
          {error && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
          {loading && <div className="mt-12 flex items-center gap-3 rounded-2xl border bg-white p-7 text-sm text-[#617466]"><Loader2 className="animate-spin" size={20} /> Loading authorised dashboard data…</div>}
          {!loading && access && metrics && <>
            <section aria-label="Live gym statistics" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(({ label, value, sub, icon: Icon }) => <div key={label} className="rounded-[22px] border border-[#e1e8dd] bg-white p-5 shadow-[0_8px_30px_rgba(20,45,28,.035)]"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#627468]">{label}</span><span className="rounded-xl bg-[#f0f7e9] p-2.5 text-[#3b6b38]"><Icon size={19}/></span></div><p className="mt-5 text-4xl font-black tracking-tight">{value}</p><p className="mt-2 text-xs text-[#748276]">{sub}</p></div>)}</section>
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(275px,1fr)]">
              <section id="attendance" className="rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Attendance pulse</p><h2 className="mt-2 text-xl font-black">Last seven days</h2><p className="mt-1 text-xs text-[#748276]">Unique members checked in per day</p></div><a href="/reception-checkin" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]">Open scanner <ArrowRight size={15}/></a></div><div className="mt-8 flex h-48 items-end gap-3 border-b border-[#dce6d8] pb-1 sm:gap-5">{metrics.visitsByDay.map((d) => <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${d.date}: ${d.count} unique visitors`}><span className="text-xs font-bold">{d.count}</span><div className="w-full max-w-14 rounded-t-xl bg-[#b8ee73] transition-all" style={{ height: `${Math.max(d.count ? 9 : 3, (d.count / maximumVisits) * 76)}%` }} /></div>)}</div><div className="mt-3 flex gap-3 sm:gap-5">{metrics.visitsByDay.map((d) => <span key={d.date} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-[#748276]">{d.label}</span>)}</div></section>
              <section className="rounded-[24px] bg-[#1a3226] p-6 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8ee73]">Needs attention</p><h2 className="mt-3 text-5xl font-black">{number(metrics.expiringCount)}</h2><p className="mt-2 font-semibold">Members expiring in seven days</p><p className="mt-3 text-sm leading-6 text-[#c2d0c4]">Members with currently valid plans ending within seven calendar days, excluding anyone with a longer active plan.</p><a href="/reception-dashboard" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#193125]">Manage memberships <ChevronRight size={17}/></a></section>
            </div>
            {access.management && <section id="revenue" className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Management only</p><h2 className="mt-2 text-xl font-black">Revenue snapshot</h2><p className="mt-1 text-xs text-[#748276]">Successful payments since your existing revenue baseline; historical imports excluded.</p></div><a href="/staff-admin#revenue" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]">Full report <ArrowRight size={15}/></a></div>{revenueError ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{revenueError}</p> : revenue ? <div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#f2f7ed] p-5"><p className="text-sm text-[#58715d]">Today</p><p className="mt-3 text-2xl font-black">{money(revenue.today)}</p></div><div className="rounded-2xl bg-[#f2f7ed] p-5"><p className="text-sm text-[#58715d]">This month</p><p className="mt-3 text-2xl font-black">{money(revenue.month)}</p></div><div className="rounded-2xl bg-[#f2f7ed] p-5"><p className="text-sm text-[#58715d]">Since baseline</p><p className="mt-3 text-2xl font-black">{money(revenue.total)}</p><p className="mt-2 text-xs text-[#607963]">{number(revenue.transactions)} successful transactions</p></div></div> : <p className="mt-4 flex items-center gap-2 text-sm text-[#748276]"><Loader2 size={16} className="animate-spin"/> Loading revenue…</p>}</section>}
            <section id="members" className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#65905c]">Front desk</p><h2 className="mt-2 text-xl font-black">Find a member</h2><p className="mt-1 text-xs text-[#748276]">Search by name or phone. Showing up to 15 matches.</p></div><a href="/reception-dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]">Full member tools <ArrowRight size={15}/></a></div><form onSubmit={(event) => void searchMembers(event)} className="mt-6 flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-3"><Search size={18} className="shrink-0 text-[#69816f]"/><span className="sr-only">Member name or phone</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Member name or phone" className="min-w-0 w-full bg-transparent py-3 text-sm outline-none"/></label><button disabled={searching} type="submit" className="rounded-xl bg-[#1a3226] px-5 text-sm font-bold text-white disabled:opacity-50">Search</button></form>{searched && !searching && !results.length && <p className="mt-4 text-sm text-[#748276]">No matching members found.</p>}{results.length > 0 && <ul className="mt-4 divide-y divide-[#e7ede4]">{results.map((member) => <li key={member.id}><a href={`/reception-member/${member.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-[#356942]"><div className="min-w-0"><p className="truncate text-sm font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-[#748276]">{member.phone || "No phone number"}</p></div><ChevronRight size={18} className="shrink-0"/></a></li>)}</ul>}</section>
            <section aria-label="Quick actions" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
              { label: "Reception dashboard", desc: "Register & renew members", href: "/reception-dashboard", icon: UserPlus },
              { label: "Member QR scanner", desc: "Check members in and out", href: "/reception-checkin", icon: Activity },
              { label: "Staff clock-in", desc: "Staff attendance portal", href: "/staff-attendance", icon: CalendarClock },
              ...(access.management ? [{ label: "Staff & revenue", desc: "Payroll and complete reports", href: "/staff-admin", icon: CreditCard }] : []),
            ].map(({ label, desc, href, icon: Icon }) => <a key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-[#e1e8dd] bg-white p-4 transition hover:border-[#7da66d]"><span className="rounded-xl bg-[#edf5e7] p-3 text-[#38673e]"><Icon size={19}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-[#748276]">{desc}</span></span><ArrowRight size={17} className="text-[#829686] transition group-hover:translate-x-1"/></a>)}</section>
            <p className="mt-8 text-center text-xs text-[#748276]">Preview only · No membership, payment or attendance changes are made on this page.</p>
          </>}
        </main>
      </div>
    </div>
  );
}
