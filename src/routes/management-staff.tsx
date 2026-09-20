import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCw, Search, ShieldCheck, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isLateArrival, lateRuleApplies, recordedWorkMinutes, workDuration, type StaffScan } from "@/lib/staff-attendance-rules";

export const Route = createFileRoute("/management-staff")({ component: ManagementStaff });
type Staff = { id: string; staff_id: string | null; full_name: string | null; position: string | null; department: string | null; role: string | null; status: string | null };
type Scan = StaffScan;
const PAGE_SIZE = 500;
const LAGOS = "Africa/Lagos";

function todayInLagos() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (key: string) => parts.find((item) => item.type === key)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function tomorrow(day: string) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function clock(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}
async function readStaff(): Promise<Staff[]> {
  const result: Staff[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("staff_profiles").select("id,staff_id,full_name,position,department,role,status")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Staff[];
    result.push(...batch);
    if (batch.length < PAGE_SIZE) return result;
  }
}
async function readScans(date: string): Promise<Scan[]> {
  const result: Scan[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("staff_attendance").select("id,staff_profile_id,checked_in_at,checked_out_at")
      .gte("checked_in_at", `${date}T00:00:00+01:00`).lt("checked_in_at", `${tomorrow(date)}T00:00:00+01:00`)
      .order("checked_in_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as Scan[];
    result.push(...batch);
    if (batch.length < PAGE_SIZE) return result;
  }
}

function ManagementStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [date, setDate] = useState(todayInLagos);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "suspended" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setAuthorized(false); setStaff([]); setScans([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the Staff Portal to view staff management.");
        const { data: user, error: staffError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (staffError) throw staffError;
        if (!user?.active || !["admin", "owner", "manager"].includes(String(user.role || "").toLowerCase())) throw Error("Only active management accounts can access staff records.");
        const [profiles, attendance] = await Promise.all([readStaff(), readScans(date)]);
        if (!cancelled) { setStaff(profiles); setScans(attendance); setAuthorized(true); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load staff information."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [date, reload]);

  const byStaff = useMemo(() => {
    const grouped = new Map<string, Scan[]>();
    for (const scan of scans) { const existing = grouped.get(scan.staff_profile_id) || []; existing.push(scan); grouped.set(scan.staff_profile_id, existing); }
    return grouped;
  }, [scans]);
  const uniqueScans = byStaff.size;
  const lateCount = staff.filter((member) => isLateArrival(member.full_name, date, byStaff.get(member.id)?.[0]?.checked_in_at || null)).length;
  const visible = staff.filter((item) => {
    const query = search.trim().toLowerCase();
    return (filter === "all" || (item.status || "pending").toLowerCase() === filter) && (!query || [item.full_name, item.staff_id, item.department, item.position, item.role].some((value) => (value || "").toLowerCase().includes(query)));
  }).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  return <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><a href="/management-operations" className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"><ArrowLeft size={16}/> Operations hub</a><p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">Super Plus / Management</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Staff & attendance</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">Team directory, punctuality and recorded QR work hours for a selected Lagos date. Staff administration and payroll stay in the original admin system.</p></div><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button></div>
    {loading && <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]"><Loader2 size={20} className="animate-spin"/> Verifying management access and loading staff records…</div>}
    {!loading && error && <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error} <a href="/staff" className="font-bold underline">Staff login</a></div>}
    {!loading && authorized && <>
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]"><ShieldCheck className="mt-0.5 shrink-0" size={20}/><p><strong>Attendance rules:</strong> The first QR clock-in after 7:30 AM Lagos time is highlighted red on Monday–Saturday. Njorteah Ifeanyi Anthony is exempt every day; Oroke Stephen chinedu is exempt on Thursday and Friday. Sundays are not assessed. Worked hours sum completed clock-in/clock-out sessions only; open sessions are excluded until clock-out. These are display indicators, not automatic payroll deductions. Missed scans require review.</p></div>
      <section aria-label="Staff overview" className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[
        { label: "Recorded staff", value: staff.length, note: "All profile statuses", icon: Users, late: false },
        { label: "Approved staff", value: staff.filter((item) => item.status === "approved").length, note: "Approved profiles", icon: CheckCircle2, late: false },
        { label: "Scanned on selected date", value: uniqueScans, note: "Unique staff members", icon: CalendarDays, late: false },
        { label: "Late arrivals", value: lateCount, note: "After 7:30 AM · exemptions applied", icon: AlertTriangle, late: true },
        { label: "Open clock-ins", value: scans.filter((item) => !item.checked_out_at).length, note: "Unfinished sessions", icon: Clock3, late: false },
      ].map(({label,value,note,icon:Icon,late}) => <div key={label} className={`rounded-[22px] border bg-white p-5 ${late && value > 0 ? "border-red-300 bg-red-50" : "border-[#e1e8dd]"}`}><div className="flex justify-between gap-2"><span className={`text-xs font-bold ${late && value > 0 ? "text-red-800" : "text-[#627468]"}`}>{label}</span><Icon size={19} className={late && value > 0 ? "text-red-600" : "text-[#3b6b38]"}/></div><p className={`mt-5 text-4xl font-black tabular-nums ${late && value > 0 ? "text-red-700" : ""}`}>{value.toLocaleString("en-NG")}</p><p className="mt-2 text-xs text-[#748276]">{note}</p></div>)}</section>
      <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-black">Staff directory</h2><p className="mt-2 text-xs text-[#748276]">First clock-in, last recorded clock-out, punctuality and completed work hours.</p></div><label className="text-xs font-bold text-[#617567]"><span className="mb-1 block">Attendance date · Lagos</span><input type="date" value={date} max={todayInLagos()} onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value) && event.target.value <= todayInLagos()) setDate(event.target.value); }} className="rounded-xl border border-[#d8e2d5] px-3 py-2.5 text-sm"/></label></div>
        <div className="mt-6 flex flex-wrap gap-3"><label className="relative min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-[#79907b]"/><span className="sr-only">Search staff</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, staff ID, role or department" className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#63915f]"/></label><label><span className="sr-only">Filter employment status</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-xl border border-[#d8e2d5] bg-white px-3 py-3 text-sm">{(["all", "approved", "pending", "suspended", "inactive"] as const).map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label></div>
        <div className="mt-5 divide-y divide-[#e7ede4]">{visible.map((member) => {
          const records = byStaff.get(member.id) || [];
          const first = records[0];
          const lastCompleted = [...records].reverse().find((item) => item.checked_out_at);
          const worked = recordedWorkMinutes(records);
          const isLate = isLateArrival(member.full_name, date, first?.checked_in_at || null);
          const assessed = lateRuleApplies(member.full_name, date);
          return <div key={member.id} className={`flex flex-wrap items-center gap-4 py-5 ${isLate ? "-mx-2 border-l-4 border-red-500 bg-red-50 px-3 sm:-mx-3 sm:px-4" : ""}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${isLate ? "bg-red-100 text-red-700" : "bg-[#eef6e8] text-[#386f40]"}`}>{(member.full_name || "?").slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="font-bold">{member.full_name || "Unnamed staff"} <span className="ml-2 rounded-full bg-[#edf3e9] px-2 py-1 align-middle text-[10px] font-bold capitalize text-[#426548]">{member.status || "Unknown status"}</span></p>
              <p className="mt-1 text-xs text-[#718172]">{[member.staff_id, member.position || member.role, member.department].filter(Boolean).join(" · ") || "Details unavailable"}</p>
              <p className={`mt-2 text-sm font-semibold ${isLate ? "text-red-700" : "text-[#496350]"}`}>{records.length ? `${records.length} session${records.length === 1 ? "" : "s"} · First in ${clock(first!.checked_in_at)} · Last out ${lastCompleted ? clock(lastCompleted.checked_out_at) : "not recorded"}` : "No QR clock-in recorded for this date"}</p>
              <p className="mt-1 text-sm font-bold text-[#264d30]">Worked hours: {worked.completed ? workDuration(worked.minutes) : "Not yet recorded"}<span className="font-normal text-[#6a796d]"> {worked.open ? `· ${worked.open} open session${worked.open === 1 ? "" : "s"} excluded` : "· completed QR sessions"}{worked.invalid ? ` · ${worked.invalid} invalid session${worked.invalid === 1 ? "" : "s"} excluded` : ""}</span></p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {records.length > 0 && <span className={`rounded-full px-3 py-2 text-xs font-black ${isLate ? "border border-red-300 bg-red-100 text-red-800" : assessed ? "bg-[#eaf6e7] text-[#316b3b]" : "bg-[#f1f3ef] text-[#607264]"}`}>{isLate ? "LATE · after 7:30 AM" : assessed ? "On time" : "Late rule exempt"}</span>}
              <span className={`rounded-full px-3 py-2 text-xs font-bold ${records.length ? "bg-[#eaf6e7] text-[#316b3b]" : "bg-[#f1f3ef] text-[#607264]"}`}>{records.length ? (worked.open ? "Open session" : "Scanned") : "No scan record"}</span>
            </div>
          </div>;
        })}{visible.length === 0 && <p className="py-10 text-center text-sm text-[#748276]">No staff match this search and status filter.</p>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ede4] pt-5"><p className="text-xs text-[#748276]">Showing {visible.length} of {staff.length} staff profiles · {scans.length} recorded sessions on {date}. Work hours update after clock-out and refresh.</p><div className="flex flex-wrap gap-2"><a href="/staff-admin" className="inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-xs font-bold text-white">Staff admin & payroll <ArrowRight size={15}/></a><a href="/staff-attendance" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-xs font-bold text-[#356942]">Staff QR scanner <ArrowRight size={15}/></a></div></div>
      </section>
    </>}
  </div></main>;
}
