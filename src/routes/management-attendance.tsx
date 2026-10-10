import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock3,
  Loader2, RefreshCw, ScanLine, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-attendance")({ component: ManagementAttendance });
type Visit = { id: string; member_id: string; checked_in_at: string | null; checked_out_at: string | null };
type Member = { id: string; full_name: string | null; phone: string | null };
type Filter = "all" | "open" | "completed";
const PAGE_SIZE = 25;
const LAGOS = "Africa/Lagos";

function lagosDay() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function nextDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function bounds(day: string) {
  return { start: `${day}T00:00:00+01:00`, end: `${nextDay(day)}T00:00:00+01:00` };
}
function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function ManagementAttendance() {
  const today = lagosDay();
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [total, setTotal] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayOpen, setTodayOpen] = useState(0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setVisits([]); setMembers({});
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in through the Staff Portal to view attendance.");
        const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["reception", "admin", "owner", "manager"].includes(String(staff.role || "").toLowerCase())) throw new Error("Only active reception and management accounts can view attendance.");
        if (cancelled) return;
        setAuthorized(true);
        const selected = bounds(day);
        const current = bounds(today);
        let query = supabase.from("attendance").select("id,member_id,checked_in_at,checked_out_at", { count: "exact" }).gte("checked_in_at", selected.start).lt("checked_in_at", selected.end);
        if (filter === "open") query = query.is("checked_out_at", null);
        if (filter === "completed") query = query.not("checked_out_at", "is", null);
        const [history, checkins, open] = await Promise.all([
          query.order("checked_in_at", { ascending: false }).order("id", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
          supabase.from("attendance").select("id", { count: "exact", head: true }).gte("checked_in_at", current.start).lt("checked_in_at", current.end),
          supabase.from("attendance").select("id", { count: "exact", head: true }).gte("checked_in_at", current.start).lt("checked_in_at", current.end).is("checked_out_at", null),
        ]);
        if (history.error) throw history.error;
        if (checkins.error) throw checkins.error;
        if (open.error) throw open.error;
        const rows = (history.data || []) as Visit[];
        const ids = [...new Set(rows.map((row) => row.member_id))];
        const lookup = ids.length ? await supabase.from("members").select("id,full_name,phone").in("id", ids) : null;
        if (lookup?.error) throw lookup.error;
        if (!cancelled) {
          setVisits(rows); setTotal(history.count || 0); setTodayTotal(checkins.count || 0); setTodayOpen(open.count || 0);
          setMembers(Object.fromEntries(((lookup?.data || []) as Member[]).map((member) => [member.id, member])));
        }
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : "Could not load attendance."); setAuthorized(false); }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [day, filter, page, reload, today]);

  return <div className="min-h-screen bg-[#f4f6f1] text-[#16221c]"><div className="mx-auto flex min-h-screen max-w-[1680px] flex-col lg:flex-row">
    <aside className="border-b border-[#243b32] bg-[#152820] px-5 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-b-0 lg:px-6 lg:py-8">
      <a href="/management-preview" className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#b8ee73] font-black text-[#193327]">S+</span><span><span className="block text-sm font-black tracking-wide">SUPER PLUS</span><span className="block text-[10px] uppercase tracking-[.26em] text-[#b9c9be]">Fitness management</span></span></a>
      <p className="mt-7 hidden text-[10px] font-bold uppercase tracking-[.2em] text-[#96ad9b] lg:block">Workspace</p>
      <nav aria-label="Management navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        <a href="/management-preview" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><ArrowLeft size={17}/> Overview</a>
        <a href="/management-members" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><Users size={17}/> Members</a>
        <a href="/management-attendance" aria-current="page" className="flex shrink-0 items-center gap-3 rounded-xl bg-[#b8ee73] px-4 py-3 text-sm font-bold text-[#183125]"><Activity size={17}/> Attendance</a>
        <a href="/reception-checkin" className="flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#d5e3d8] hover:bg-white/10"><ScanLine size={17}/> QR scanner</a>
      </nav><p className="mt-auto hidden pt-8 text-xs leading-5 text-[#b9c9be] lg:block">Read-only history. All scanning remains in your existing QR system.</p>
    </aside>
    <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#5f7b68]">Super Plus / Operations</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Attendance history</h1><p className="mt-2 text-sm text-[#637469]">Review member check-ins and check-outs in Lagos time.</p></div><a href="/reception-checkin" className="inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-sm font-bold text-white"><ScanLine size={17}/> Open scanner <ArrowRight size={16}/></a></header>
      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></p>}
      {loading && <div className="mt-7 flex items-center gap-3 rounded-2xl border bg-white p-7 text-sm text-[#617466]"><Loader2 className="animate-spin" size={20}/> Loading authorised attendance data…</div>}
      {!loading && authorized && !error && <>
        <section aria-label="Attendance summary" className="mt-7 grid gap-4 sm:grid-cols-3">{[
          { label: "Today's check-ins", value: todayTotal, note: "Attendance records", icon: Activity },
          { label: "Open from today", value: todayOpen, note: "Not checked out yet", icon: Clock3 },
          { label: "Matching records", value: total, note: "Selected date and filter", icon: Users },
        ].map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-[22px] border border-[#e1e8dd] bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#627468]">{label}</span><span className="rounded-xl bg-[#f0f7e9] p-2 text-[#3b6b38]"><Icon size={19}/></span></div><p className="mt-5 text-4xl font-black">{new Intl.NumberFormat("en-NG").format(value)}</p><p className="mt-2 text-xs text-[#748276]">{note}</p></div>)}</section>
        <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-4 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-black">Visit records</h2><p className="mt-1 text-xs text-[#748276]">Grouped by check-in date · no attendance edits on this page.</p></div><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#ccd8cb] bg-white px-4 py-3 text-sm font-semibold"><RefreshCw size={16}/> Refresh</button></div>
          <div className="mt-6 flex flex-wrap items-end gap-4"><label className="flex flex-col gap-2 text-xs font-bold text-[#5f7b68]">Check-in date<input type="date" value={day} max={today} onChange={(event) => { setDay(event.target.value || today); setPage(1); }} className="rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-sm text-[#16221c]"/></label><div className="flex gap-2 overflow-x-auto pb-1" aria-label="Attendance filters">{(["all", "open", "completed"] as Filter[]).map((option) => <button type="button" key={option} aria-pressed={filter === option} onClick={() => { setFilter(option); setPage(1); }} className={`shrink-0 rounded-full border px-4 py-3 text-xs font-bold ${filter === option ? "border-[#193d2b] bg-[#193d2b] text-white" : "border-[#e0e7de] bg-white text-[#58715d]"}`}>{option === "all" ? "All visits" : option === "open" ? "Not checked out" : "Checked out"}</button>)}</div></div>
          <p className="mt-5 text-xs text-[#748276]">{total} matching records · page {Math.min(page, pages)} of {pages}</p>
          <div className="mt-3 divide-y divide-[#e7ede4]">{visits.map((visit) => { const member = members[visit.member_id]; return <div key={visit.id} className="flex flex-wrap items-center gap-3 py-4"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6e8] text-[#376a3c]"><Users size={17}/></span><div className="min-w-0"><p className="truncate text-sm font-bold">{member?.full_name || "Member record unavailable"}</p><p className="mt-1 text-xs text-[#748276]">{member?.phone || "Phone not available"}</p></div></div><div className="text-xs text-[#58715d]"><p><span className="font-semibold">In:</span> {formatTime(visit.checked_in_at)}</p><p className="mt-1"><span className="font-semibold">Out:</span> {formatTime(visit.checked_out_at)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${visit.checked_out_at ? "bg-[#e9f4e4] text-[#38673e]" : "bg-amber-50 text-amber-800"}`}>{visit.checked_out_at ? "Checked out" : "Open visit"}</span><a href={`/reception-member/${visit.member_id}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#356942]">Profile <ArrowRight size={15}/></a></div>; })}{visits.length === 0 && <p className="py-12 text-center text-sm text-[#748276]">No attendance records match this date and filter.</p>}</div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-1 rounded-xl border border-[#ccd8cb] px-3 py-2 text-sm font-semibold disabled:opacity-35"><ChevronLeft size={17}/> Previous</button><span className="text-xs text-[#748276]">Page {Math.min(page, pages)} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-xl border border-[#ccd8cb] px-3 py-2 text-sm font-semibold disabled:opacity-35">Next <ChevronRight size={17}/></button></div>
          <p className="mt-5 text-xs leading-5 text-[#748276]">These are attendance records, not unique people. The open-visit total includes only check-ins started today, not older unclosed visits.</p>
        </section>
      </>}
    </main>
  </div></div>;
}
