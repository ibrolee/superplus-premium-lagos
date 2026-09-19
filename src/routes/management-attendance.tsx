import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock3, Loader2, RefreshCw, ScanLine, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-attendance")({ component: ManagementAttendance });
type Visit = { id: string; member_id: string; checked_in_at: string | null; checked_out_at: string | null };
type Member = { id: string; full_name: string | null; phone: string | null };
type Filter = "all" | "open" | "completed";
const PAGE_SIZE = 25;
const LAGOS = "Africa/Lagos";
function lagosDay() { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const get = (type: string) => parts.find(part => part.type === type)?.value || ""; return `${get("year")}-${get("month")}-${get("day")}`; }
function nextDay(day: string) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function bounds(day: string) { return { start: `${day}T00:00:00+01:00`, end: `${nextDay(day)}T00:00:00+01:00` }; }
function formatTime(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date); }
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
  useEffect(() => { let cancelled = false; (async () => { setLoading(true); setError(""); setAuthorized(false); setVisits([]); setMembers({}); try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Sign in through the reception or admin portal to view attendance.");
    const { data: staff, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
    if (staffError) throw staffError;
    if (!staff?.active || !["reception","admin","owner","manager"].includes(String(staff.role || "").toLowerCase())) throw new Error("Reception or management access is required.");
    const selected = bounds(day), current = bounds(today);
    let query = supabase.from("attendance").select("id,member_id,checked_in_at,checked_out_at", { count: "exact" }).gte("checked_in_at",selected.start).lt("checked_in_at",selected.end);
    if (filter==="open") query=query.is("checked_out_at",null);
    if (filter==="completed") query=query.not("checked_out_at","is",null);
    const [history,checkins,open] = await Promise.all([
      query.order("checked_in_at",{ascending:false}).order("id",{ascending:true}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1),
      supabase.from("attendance").select("id",{count:"exact",head:true}).gte("checked_in_at",current.start).lt("checked_in_at",current.end),
      supabase.from("attendance").select("id",{count:"exact",head:true}).gte("checked_in_at",current.start).lt("checked_in_at",current.end).is("checked_out_at",null),
    ]);
    if (history.error) throw history.error; if (checkins.error) throw checkins.error; if (open.error) throw open.error;
    const records = (history.data||[]) as Visit[];
    const ids = [...new Set(records.map(row=>row.member_id))];
    const lookup = ids.length ? await supabase.from("members").select("id,full_name,phone").in("id",ids) : null;
    if (lookup?.error) throw lookup.error;
    if (!cancelled) { setAuthorized(true); setVisits(records); setTotal(history.count||0); setTodayTotal(checkins.count||0); setTodayOpen(open.count||0); setMembers(Object.fromEntries(((lookup?.data||[]) as Member[]).map(member=>[member.id,member]))); }
  } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load attendance."); } finally { if (!cancelled) setLoading(false); } })(); return () => { cancelled=true; }; }, [day,filter,page,reload,today]);
  return <main className="min-h-screen min-w-0 bg-[#f4f6f1] px-3 py-6 text-[#16221c] sm:px-7 sm:py-9 lg:px-10"><div className="mx-auto w-full min-w-0 max-w-6xl">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><a href="/reception-workspace" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Reception 2.0</a><h1 className="mt-5 break-words text-3xl font-black sm:text-4xl">Attendance history</h1><p className="mt-2 text-sm leading-6 text-[#637469]">Review member visits in Lagos time.</p></div><a href="/reception-checkin" className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-sm font-bold text-white sm:w-auto"><ScanLine size={17}/> QR scanner <ArrowRight size={16}/></a></header>
    {error && <p role="alert" className="mt-6 break-words rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error} <a href="/portal/reception" className="font-bold underline">Reception login</a></p>}
    {loading && <p role="status" className="mt-7 flex items-center gap-3 rounded-2xl bg-white p-5 text-sm"><Loader2 className="animate-spin" size={20}/> Loading attendance…</p>}
    {!loading && authorized && !error && <>
      <section aria-label="Attendance summary" className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">{[
        {label:"Today's check-ins",value:todayTotal,note:"Attendance records",icon:Activity},
        {label:"Open from today",value:todayOpen,note:"No checkout recorded",icon:Clock3},
        {label:"Matching records",value:total,note:"Selected date and filter",icon:Users},
      ].map(({label,value,note,icon:Icon})=><div key={label} className="min-w-0 rounded-2xl border border-[#e1e8dd] bg-white p-3 sm:p-5"><div className="flex min-w-0 items-start justify-between gap-1"><p className="min-w-0 break-words text-xs font-semibold leading-5 text-[#627468] sm:text-sm">{label}</p><Icon size={19} className="shrink-0 text-[#3b6b38]"/></div><p className="mt-4 text-3xl font-black sm:text-4xl">{value.toLocaleString("en-NG")}</p><p className="mt-2 break-words text-xs text-[#748276]">{note}</p></div>)}</section>
      <section className="mt-6 min-w-0 rounded-2xl border border-[#e1e8dd] bg-white p-3 sm:rounded-3xl sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black">Visit records</h2><p className="mt-1 text-xs text-[#748276]">Read-only attendance for the selected day.</p></div><button type="button" onClick={()=>setReload(value=>value+1)} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold sm:w-auto"><RefreshCw size={16}/> Refresh</button></div>
        <div className="mt-6 flex min-w-0 flex-col flex-wrap gap-4 sm:flex-row sm:items-end"><label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-[#5f7b68]">Check-in date<input type="date" value={day} max={today} onChange={event=>{setDay(event.target.value||today);setPage(1);}} className="w-full min-w-0 rounded-xl border border-[#d8e2d5] bg-[#f8faf6] px-4 py-3 text-sm text-[#16221c] sm:w-auto"/></label><div className="flex min-w-0 flex-wrap gap-2" aria-label="Attendance filters">{(["all","open","completed"] as Filter[]).map(option=><button type="button" key={option} aria-pressed={filter===option} onClick={()=>{setFilter(option);setPage(1);}} className={`rounded-full border px-3 py-2 text-xs font-bold sm:px-4 ${filter===option?"border-[#193d2b] bg-[#193d2b] text-white":"border-[#e0e7de] text-[#58715d]"}`}>{option==="all"?"All visits":option==="open"?"Not checked out":"Checked out"}</button>)}</div></div>
        <p className="mt-5 text-xs text-[#748276]">{total} records · page {Math.min(page,pages)} of {pages}</p>
        <div className="mt-3 divide-y divide-[#e7ede4]">{visits.map(visit=>{ const member=members[visit.member_id]; return <article key={visit.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="flex min-w-0 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6e8] text-[#376a3c]"><Users size={17}/></span><div className="min-w-0"><p className="break-words text-sm font-bold">{member?.full_name||"Member record unavailable"}</p><p className="mt-1 break-all text-xs text-[#748276]">{member?.phone||"Phone unavailable"}</p><a href={`/reception-member/${encodeURIComponent(visit.member_id)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#356942]">Open profile <ArrowRight size={14}/></a></div></div><div className="min-w-0 space-y-1 text-xs text-[#58715d]"><p><strong>In:</strong> {formatTime(visit.checked_in_at)}</p><p><strong>Out:</strong> {formatTime(visit.checked_out_at)}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${visit.checked_out_at?"bg-[#e9f4e4] text-[#38673e]":"bg-amber-50 text-amber-800"}`}>{visit.checked_out_at?"Checked out":"Open visit"}</span></article>;})}{!visits.length && <p className="py-12 text-center text-sm text-[#748276]">No visits match these filters.</p>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><button type="button" disabled={page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"><ChevronLeft size={16}/> Previous</button><span className="text-xs">Page {Math.min(page,pages)} / {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage(value=>value+1)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40">Next <ChevronRight size={16}/></button></div>
        <p className="mt-5 text-xs leading-5 text-[#748276]">Open visits count only visits started today. No changes are made to attendance on this page.</p>
      </section>
    </>}
  </div></main>;
}
