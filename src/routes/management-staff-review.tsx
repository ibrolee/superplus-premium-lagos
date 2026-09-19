import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Clock3, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isLateArrival, recordedWorkMinutes, workDuration, type StaffScan } from "@/lib/staff-attendance-rules";

export const Route = createFileRoute("/management-staff-review")({ component: StaffAttendanceReview });
type Staff = { id: string; staff_id: string | null; full_name: string | null; position: string | null; status: string | null };
type Review = { staff: Staff; scans: StaffScan[]; firstIn: string; minutes: number; late: boolean; open: number; invalid: number; overlapping: number; completed: number };
type Issue = "all" | "late" | "open" | "overlapping" | "invalid";
const PAGE_SIZE = 500;
const ZONE = "Africa/Lagos";
function lagosToday() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function nextDay(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}
function lagosClock(timestamp: string | null) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "Invalid / missing";
  return new Intl.DateTimeFormat("en-NG", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(timestamp));
}
async function loadPages<T>(table: "staff_profiles" | "staff_attendance", fields: string, date?: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(table).select(fields);
    if (date) query = query.gte("checked_in_at", `${date}T00:00:00+01:00`).lt("checked_in_at", `${nextDay(date)}T00:00:00+01:00`);
    const { data, error } = await query.order(date ? "checked_in_at" : "id", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    result.push(...batch);
    if (batch.length < PAGE_SIZE) return result;
  }
}
function StaffAttendanceReview() {
  const [date, setDate] = useState(lagosToday);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [scans, setScans] = useState<StaffScan[]>([]);
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState<Issue>("all");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setAuthorized(false); setError(""); setStaff([]); setScans([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the Staff Portal first.");
        const { data: account, error: roleError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (roleError) throw roleError;
        if (!account?.active || !["admin", "owner", "manager"].includes(String(account.role || "").toLowerCase())) throw Error("Only active management accounts can review staff QR exceptions.");
        const [people, sessions] = await Promise.all([
          loadPages<Staff>("staff_profiles", "id,staff_id,full_name,position,status"),
          loadPages<StaffScan>("staff_attendance", "id,staff_profile_id,checked_in_at,checked_out_at", date),
        ]);
        if (!cancelled) { setStaff(people); setScans(sessions); setAuthorized(true); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load staff QR records."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [date, refresh]);
  const reviews = useMemo((): Review[] => {
    const groups = new Map<string, StaffScan[]>();
    scans.forEach((scan) => { const group = groups.get(scan.staff_profile_id) || []; group.push(scan); groups.set(scan.staff_profile_id, group); });
    return staff.flatMap((person) => {
      const rows = groups.get(person.id);
      if (!rows?.length) return [];
      const work = recordedWorkMinutes(rows);
      const result: Review = { staff: person, scans: rows, firstIn: rows[0].checked_in_at, minutes: work.minutes,
        late: isLateArrival(person.full_name, date, rows[0].checked_in_at), open: work.open, invalid: work.invalid,
        overlapping: work.overlapping, completed: work.completed };
      return [result];
    }).filter((item) => item.late || item.open || item.invalid || item.overlapping)
      .sort((a, b) => (a.staff.full_name || "").localeCompare(b.staff.full_name || ""));
  }, [staff, scans, date]);
  const visible = reviews.filter((item) => {
    const term = query.trim().toLowerCase();
    return (issue === "all" || (issue === "late" && item.late) || (issue === "open" && item.open > 0) ||
      (issue === "overlapping" && item.overlapping > 0) || (issue === "invalid" && item.invalid > 0)) &&
      (!term || [item.staff.full_name, item.staff.staff_id, item.staff.position].some((value) => (value || "").toLowerCase().includes(term)));
  });
  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><a href="/management-staff" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Staff directory</a><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">Super Plus / Management</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">QR attendance review</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">Find recorded late arrivals, unfinished shifts, overlapping clock-ins and invalid sessions for a selected day.</p></div><button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]"><Loader2 size={20} className="animate-spin"/> Verifying management access and loading QR records…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
    {!loading && authorized && <>
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]"><ShieldCheck size={20} className="mt-0.5 shrink-0"/><p><strong>Review only — no penalties or edits.</strong> The 7:30 AM Monday–Saturday rule preserves both named exceptions. An open session on the current date may still be in progress. Records are grouped by their recorded clock-in date in Lagos; a missing scan does not prove absence. Overlapping completed sessions are counted only once in worked hours, and incomplete or invalid sessions are excluded. Verify QR records and missed-scan reports separately before payroll decisions.</p></div>
      <section aria-label="Review controls" className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">Recorded exceptions</h2><p className="mt-2 text-xs text-[#718172]">{scans.length} sessions loaded · {staff.length} staff profiles</p></div><label className="text-xs font-bold text-[#607465]"><span className="mb-2 block">Review date · Lagos</span><input type="date" value={date} max={lagosToday()} onChange={(event) => { const value = event.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value <= lagosToday()) setDate(value); }} className="rounded-xl border border-[#d8e2d5] px-4 py-3 text-sm"/></label></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
          { label: "Staff needing review", value: reviews.length, color: "text-[#193d2b]" },
          { label: "Late arrivals", value: reviews.filter((item) => item.late).length, color: "text-red-700" },
          { label: "Open sessions", value: reviews.reduce((total, item) => total + item.open, 0), color: "text-amber-700" },
          { label: "Overlapping sessions", value: reviews.reduce((total, item) => total + item.overlapping, 0), color: "text-red-700" },
          { label: "Invalid sessions", value: reviews.reduce((total, item) => total + item.invalid, 0), color: "text-amber-700" },
        ].map((item) => <div key={item.label} className="rounded-2xl border border-[#e2e9dd] bg-[#f8faf6] p-4"><p className="text-xs font-bold text-[#607465]">{item.label}</p><p className={`mt-4 text-3xl font-black tabular-nums ${item.color}`}>{item.value}</p></div>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><label className="relative min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-[#79907b]"/><span className="sr-only">Search staff for attendance review</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff name or ID" className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] py-3 pl-10 pr-3 text-sm"/></label><label><span className="sr-only">Filter exception type</span><select value={issue} onChange={(event) => setIssue(event.target.value as Issue)} className="rounded-xl border border-[#d8e2d5] bg-white px-3 py-3 text-sm"><option value="all">All issues</option><option value="late">Late arrivals</option><option value="open">Open sessions</option><option value="overlapping">Overlapping sessions</option><option value="invalid">Invalid sessions</option></select></label></div>
        <div className="mt-5 divide-y divide-[#e7ede4]">{visible.map((item) => <div key={item.staff.id} className="flex flex-wrap items-start gap-4 py-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><AlertTriangle size={20}/></span><div className="min-w-0 flex-1"><p className="font-black">{item.staff.full_name || "Unnamed staff"}</p><p className="mt-1 text-xs text-[#718172]">{item.staff.staff_id || "No staff ID"} · {item.staff.position || item.staff.status || "Staff"} · {item.scans.length} recorded QR sessions</p><p className="mt-2 text-xs font-medium text-[#607465]">First clock-in: {lagosClock(item.firstIn)} · Completed work: {workDuration(item.minutes)} ({item.completed} completed)</p><div className="mt-3 flex flex-wrap gap-2">{item.late && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-800">LATE · after 7:30 AM</span>}{item.open > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{item.open} open {date === lagosToday() ? "· may still be working" : "· needs review"}</span>}{item.overlapping > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-800">{item.overlapping} overlap · no double-counting</span>}{item.invalid > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{item.invalid} invalid · excluded</span>}</div></div><a href="/management-staff-monthly" className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold text-[#356942]">Monthly details <ArrowRight size={14}/></a></div>)}{visible.length === 0 && <p className="py-10 text-center text-sm text-[#748276]">{reviews.length ? "No recorded exceptions match your filters." : "No late, open, overlapping or invalid QR sessions were found for this date. Missing scans still require separate review."}</p>}</div>
      </section><div className="mt-6 flex flex-wrap gap-3"><a href="/management-attendance-export" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-xs font-bold text-[#356942]"><CalendarDays size={16}/> Attendance exports</a><a href="/staff-admin" className="inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-xs font-bold text-white"><Clock3 size={16}/> Original Staff Admin</a></div>
    </>}
  </div></main>;
}
