import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-members")({ component: ManagementMembers });

type Member = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Membership = { id: string; member_id: string; plan_name: string | null; start_date: string | null; end_date: string | null; status: string | null };
type Status = "active" | "expiring" | "upcoming" | "paused" | "expired" | "inactive";
type MemberRow = Member & { plan: string; expiry: string | null; status: Status };
type Filter = "all" | "active" | "expiring" | "expired" | "inactive";
const PAGE_SIZE = 20;
const statusLabels: Record<Status, string> = { active: "Active", expiring: "Expiring soon", upcoming: "Upcoming", paused: "Paused", expired: "Expired", inactive: "No active plan" };

function lagosDay() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function addDays(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function formatDate(date: string | null) {
  return date ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`)) : "—";
}
async function readAll<T>(table: "members" | "memberships", columns: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    const batch = (data || []) as T[];
    result.push(...batch);
    if (batch.length < 500) return result;
  }
}
function makeRow(member: Member, plans: Membership[], today: string, cutoff: string): MemberRow {
  const byExpiry = [...plans].sort((a, b) => (b.end_date || "").localeCompare(a.end_date || ""));
  const active = byExpiry.find((m) => !!m.start_date && !!m.end_date && m.start_date.slice(0, 10) <= today && m.end_date.slice(0, 10) >= today && !["paused", "cancelled"].includes((m.status || "").toLowerCase()));
  const upcoming = byExpiry.find((m) => !!m.start_date && m.start_date.slice(0, 10) > today && !["paused", "cancelled"].includes((m.status || "").toLowerCase()));
  const chosen = active || upcoming || byExpiry[0];
  let status: Status = "inactive";
  if (active) status = active.end_date!.slice(0, 10) <= cutoff ? "expiring" : "active";
  else if (upcoming) status = "upcoming";
  else if (byExpiry.some((m) => (m.status || "").toLowerCase() === "paused")) status = "paused";
  else if (byExpiry.some((m) => !!m.end_date && m.end_date.slice(0, 10) < today)) status = "expired";
  return { ...member, plan: chosen?.plan_name || "No membership", expiry: chosen?.end_date || null, status };
}

function ManagementMembers() {
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const today = lagosDay();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Please sign in through the Staff Portal first.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        const nextRole = String(staff?.role || "").toLowerCase();
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(nextRole)) throw new Error("Only active reception and management accounts can access the member directory.");
        if (cancelled) return;
        setRole(nextRole);
        const [memberRows, planRows] = await Promise.all([
          readAll<Member>("members", "id,full_name,email,phone"),
          readAll<Membership>("memberships", "id,member_id,plan_name,start_date,end_date,status"),
        ]);
        if (!cancelled) { setMembers(memberRows); setMemberships(planRows); }
      } catch (cause) {
        if (!cancelled) { setRole(null); setError(cause instanceof Error ? cause.message : "Unable to load member records."); }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  const rows = useMemo(() => {
    const grouped = new Map<string, Membership[]>();
    for (const membership of memberships) {
      const plans = grouped.get(membership.member_id) || [];
      plans.push(membership);
      grouped.set(membership.member_id, plans);
    }
    const cutoff = addDays(today, 7);
    return members.map((member) => makeRow(member, grouped.get(member.id) || [], today, cutoff)).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [members, memberships, today]);
  const countActive = rows.filter((m) => ["active", "expiring"].includes(m.status)).length;
  const countExpiring = rows.filter((m) => m.status === "expiring").length;
  const countExpired = rows.filter((m) => m.status === "expired").length;
  const countOther = rows.length - countActive - countExpired;
  const tabs: { value: Filter; text: string; count: number }[] = [
    { value: "all", text: "All members", count: rows.length },
    { value: "active", text: "Active", count: countActive },
    { value: "expiring", text: "Expiring", count: countExpiring },
    { value: "expired", text: "Expired", count: countExpired },
    { value: "inactive", text: "Other", count: countOther },
  ];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "active" && !["active", "expiring"].includes(row.status)) return false;
      if (filter === "expiring" && row.status !== "expiring") return false;
      if (filter === "expired" && row.status !== "expired") return false;
      if (filter === "inactive" && !["inactive", "paused", "upcoming"].includes(row.status)) return false;
      return !needle || [row.full_name, row.phone, row.email].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [rows, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const management = ["admin", "owner", "manager"].includes(role || "");

  return <div className="min-h-screen bg-[#f4f6f1] text-[#16221c]">
    <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col lg:flex-row">
      <aside className="border-b border-[#243b32] bg-[#152820] px-5 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:px-6 lg:py-8">
        <a href="/management-preview" className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8ee73] font-black text-[#193327]">S+</div><div><p className="text-sm font-black tracking-wide">SUPER PLUS</p><p className="text-[10px] uppercase tracking-[.26em] text-[#b9c9be]">Fitness management</p></div></a>
        <p className="mt-7 hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#96ad9b] lg:block">Workspace</p>
        <nav aria-label="Management navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          <a href="/management-preview" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><ArrowLeft size={17}/> Overview</a>
          <a href="/management-members" aria-current="page" className="flex shrink-0 items-center gap-3 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#183125]"><Users size={17}/> Members</a>
          <a href="/management-standard-plan" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><UserPlus size={17}/> Registration & renewals</a>
          <a href="/reception-checkin" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Activity size={17}/> Member attendance</a>
          {management && <a href="/staff-admin" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Wallet size={17}/> Staff & revenue</a>}
        </nav>
        <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block"><ShieldCheck className="text-[#b8ee73]" size={20}/><p className="mt-3 text-sm font-semibold">Protected workspace</p><p className="mt-1 text-xs leading-5 text-[#b9c9be]">Uses your existing member records. Registration and payment changes use dedicated protected forms.</p></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#5f7b68]">Super Plus / Members</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Member directory</h1><p className="mt-2 text-sm text-[#637469]">Search members, review plan status and open their existing profiles.</p></div><button type="button" disabled={loading} onClick={() => setReload((n) => n + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></header>
        {error && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
        {loading && <div className="mt-7 flex items-center gap-3 rounded-2xl border bg-white p-7 text-sm text-[#617466]"><Loader2 className="animate-spin" size={20}/> Loading authorised member records…</div>}
        {!loading && role && !error && <>
          <section aria-label="Membership overview" className="mt-7 grid gap-4 sm:grid-cols-3">{[
            { title: "Registered members", value: rows.length, icon: Users },
            { title: "Active members", value: countActive, icon: CheckCircle2 },
            { title: "Expiring in seven days", value: countExpiring, icon: CalendarClock },
          ].map(({title,value,icon:Icon}) => <div key={title} className="rounded-[22px] border border-[#e1e8dd] bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#627468]">{title}</span><span className="rounded-xl bg-[#f0f7e9] p-2 text-[#3b6b38]"><Icon size={19}/></span></div><p className="mt-5 text-4xl font-black">{new Intl.NumberFormat("en-NG").format(value)}</p></div>)}</section>
          <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">All member records</h2><p className="mt-1 text-xs text-[#748276]">Read-only directory · registrations and payments use dedicated protected tools.</p></div><a href="/management-standard-plan" className="inline-flex items-center gap-2 rounded-xl bg-[#1a3226] px-4 py-3 text-sm font-bold text-white"><UserPlus size={17}/> Registration & renewals</a></div>
            <label className="mt-6 flex items-center gap-3 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4"><Search size={19} className="text-[#69816f]"/><span className="sr-only">Search member name, phone or email</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, phone or email" className="min-w-0 w-full bg-transparent py-4 text-sm outline-none"/></label>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Filter members">{tabs.map((tab) => <button type="button" key={tab.value} aria-pressed={filter === tab.value} onClick={() => { setFilter(tab.value); setPage(1); }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${filter === tab.value ? "border-[#193d2b] bg-[#193d2b] text-white" : "border-[#e0e7de] bg-white text-[#58715d] hover:bg-[#f1f6ed]"}`}>{tab.text} · {tab.count}</button>)}</div>
            <p className="mt-3 text-xs text-[#748276]">{filtered.length} matching members · page {current} of {pages}</p>
            <div className="mt-4 divide-y divide-[#e7ede4]">{visible.map((member) => <a href={`/reception-member/${member.id}`} key={member.id} className="group flex items-center gap-3 py-4 hover:text-[#356942]"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf5e7] text-sm font-black text-[#38673e]">{(member.full_name || "?").trim().slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{member.full_name || "Unnamed member"}</p><p className="mt-1 truncate text-xs text-[#748276]">{member.phone || member.email || "No contact details"} · {member.plan}</p><p className="mt-1 text-xs text-[#748276]">Plan ends: {formatDate(member.expiry)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold sm:px-3 sm:text-xs ${member.status === "active" ? "bg-emerald-50 text-emerald-800" : member.status === "expiring" ? "bg-amber-50 text-amber-800" : "bg-[#f1f3ef] text-[#647468]"}`}>{statusLabels[member.status]}</span><ChevronRight size={18} className="hidden shrink-0 text-[#829686] sm:block"/></a>)}{!visible.length && <p className="py-12 text-center text-sm text-[#748276]">No members match this search or filter.</p>}</div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="text-xs text-[#748276]">{current} / {pages}</span><button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40">Next <ChevronRight size={16}/></button></div>
          </section>
          <div className="mt-6 flex flex-wrap gap-4 text-sm"><a className="inline-flex items-center gap-2 font-bold text-[#356942]" href="/management-preview"><ArrowLeft size={17}/> Back to overview</a><a className="inline-flex items-center gap-2 font-bold text-[#356942]" href="/reception-workspace">Open Reception 2.0 <ArrowRight size={17}/></a></div>
        </>}
      </main>
    </div>
  </div>;
}
