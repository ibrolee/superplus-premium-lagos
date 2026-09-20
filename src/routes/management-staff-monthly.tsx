import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  isLateArrival,
  recordedWorkMinutes,
  workDuration,
  type StaffScan,
} from "@/lib/staff-attendance-rules";

export const Route = createFileRoute("/management-staff-monthly")({
  component: MonthlyStaffAttendance,
});
type Staff = {
  id: string;
  staff_id: string | null;
  full_name: string | null;
  position: string | null;
  department: string | null;
  status: string | null;
};
type Day = { date: string; firstIn: string; scans: StaffScan[]; late: boolean };
type Summary = {
  staff: Staff;
  days: Day[];
  late: number;
  minutes: number;
  open: number;
  invalid: number;
  completed: number;
  overlapping: number;
};
const LAGOS = "Africa/Lagos";
const BATCH = 500;
function today() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (kind: string) => parts.find((p) => p.type === kind)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function dateInLagos(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const get = (kind: string) => parts.find((p) => p.type === kind)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function nextMonth(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}
function time(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: LAGOS,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
async function allStaff(): Promise<Staff[]> {
  const items: Staff[] = [];
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id,staff_id,full_name,position,department,status")
      .order("id")
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    const page = (data || []) as Staff[];
    items.push(...page);
    if (page.length < BATCH) return items;
  }
}
async function allScans(month: string): Promise<StaffScan[]> {
  const items: StaffScan[] = [];
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase
      .from("staff_attendance")
      .select("id,staff_profile_id,checked_in_at,checked_out_at")
      .gte("checked_in_at", `${month}-01T00:00:00+01:00`)
      .lt("checked_in_at", `${nextMonth(month)}-01T00:00:00+01:00`)
      .order("checked_in_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    const page = (data || []) as StaffScan[];
    items.push(...page);
    if (page.length < BATCH) return items;
  }
}
function MonthlyStaffAttendance() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [scans, setScans] = useState<StaffScan[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "late" | "open" | "overlap">("all");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setAuthorized(false);
      setError("");
      setStaff([]);
      setScans([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the Staff Portal first.");
        const { data: user, error: roleError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (roleError) throw roleError;
        if (
          !user?.active ||
          !["admin", "owner", "manager"].includes(String(user.role || "").toLowerCase())
        )
          throw Error("Only active management accounts can review monthly staff attendance.");
        const [staffRows, scanRows] = await Promise.all([allStaff(), allScans(month)]);
        if (!cancelled) {
          setStaff(staffRows);
          setScans(scanRows);
          setAuthorized(true);
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to load staff attendance.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month, reload]);
  const summaries = useMemo((): Summary[] => {
    const grouped = new Map<string, Map<string, StaffScan[]>>();
    for (const scan of scans) {
      const date = dateInLagos(scan.checked_in_at);
      if (!date || date.slice(0, 7) !== month) continue;
      let dates = grouped.get(scan.staff_profile_id);
      if (!dates) {
        dates = new Map();
        grouped.set(scan.staff_profile_id, dates);
      }
      const rows = dates.get(date) || [];
      rows.push(scan);
      dates.set(date, rows);
    }
    return staff
      .map((person) => {
        const dates = grouped.get(person.id) || new Map<string, StaffScan[]>();
        const days: Day[] = Array.from(dates, ([date, rows]) => ({
          date,
          firstIn: rows[0]!.checked_in_at,
          scans: rows,
          late: isLateArrival(person.full_name, date, rows[0]!.checked_in_at),
        })).sort((a, b) => b.date.localeCompare(a.date));
        const total = recordedWorkMinutes(days.flatMap((day) => day.scans));
        return {
          staff: person,
          days,
          late: days.filter((day) => day.late).length,
          minutes: total.minutes,
          completed: total.completed,
          open: total.open,
          invalid: total.invalid,
          overlapping: total.overlapping,
        };
      })
      .sort((a, b) => (a.staff.full_name || "").localeCompare(b.staff.full_name || ""));
  }, [staff, scans, month]);
  const visible = summaries.filter((item) => {
    const needle = search.trim().toLowerCase();
    return (
      (filter === "all" ||
        (filter === "late" && item.late > 0) ||
        (filter === "open" && item.open > 0) ||
        (filter === "overlap" && item.overlapping > 0)) &&
      (!needle ||
        [
          item.staff.full_name,
          item.staff.staff_id,
          item.staff.position,
          item.staff.department,
        ].some((field) => (field || "").toLowerCase().includes(needle)))
    );
  });
  const lateTotal = summaries.reduce((sum, item) => sum + item.late, 0);
  const allMinutes = summaries.reduce((sum, item) => sum + item.minutes, 0);
  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a
              href="/management-staff"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"
            >
              <ArrowLeft size={16} /> Daily staff directory
            </a>
            <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">
              Super Plus / Management
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Monthly attendance
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">
              Review recorded QR activity and completed work hours across a month, including your
              existing late-arrival exceptions.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setReload((n) => n + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {loading && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]">
            <Loader2 className="animate-spin" size={20} /> Loading staff attendance…
          </div>
        )}
        {!loading && error && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
          >
            {error}{" "}
            <a href="/staff" className="font-bold underline">
              Staff login
            </a>
          </div>
        )}
        {!loading && authorized && (
          <>
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d9e6d2] bg-[#eef6e9] p-5 text-sm leading-6 text-[#476149]">
              <ShieldCheck className="mt-0.5 shrink-0" size={20} />
              <p>
                <strong>Review only — not payroll.</strong> Hours count completed QR sessions
                starting during the selected month; sessions still open are excluded. Overlapping
                completed sessions count once toward worked time and are flagged for review. A
                missing scan does not prove absence. Late means the first recorded clock-in after
                7:30 AM Monday–Saturday, excluding Njorteah Ifeanyi Anthony entirely and Oroke
                Stephen chinedu on Thursdays/Fridays. Salary and attendance records are never
                altered here.
              </p>
            </div>
            <section
              aria-label="Monthly controls"
              className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <label className="text-xs font-bold text-[#617567]">
                  <span className="mb-2 block">Reporting month · Lagos</span>
                  <input
                    type="month"
                    value={month}
                    max={today().slice(0, 7)}
                    onChange={(event) => {
                      if (
                        /^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) &&
                        event.target.value <= today().slice(0, 7)
                      )
                        setMonth(event.target.value);
                    }}
                    className="rounded-xl border border-[#d8e2d5] px-4 py-3 text-sm"
                  />
                </label>
                <span className="text-xs font-semibold text-[#718172]">
                  {scans.length} recorded sessions loaded
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { name: "Staff profiles", value: String(staff.length), icon: Users },
                  {
                    name: "Staff with scans",
                    value: String(summaries.filter((item) => item.days.length > 0).length),
                    icon: CalendarDays,
                  },
                  { name: "Late arrival days", value: String(lateTotal), icon: AlertTriangle },
                  { name: "Completed work time", value: workDuration(allMinutes), icon: Clock3 },
                ].map(({ name, value, icon: Icon }) => (
                  <div key={name} className="rounded-2xl border border-[#e2e9dd] bg-[#f8faf6] p-4">
                    <div className="flex justify-between gap-2">
                      <p className="text-xs font-bold text-[#607465]">{name}</p>
                      <Icon size={18} className="text-[#38673e]" />
                    </div>
                    <p className="mt-4 text-2xl font-black tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
              <div className="flex flex-wrap gap-3">
                <label className="relative min-w-0 flex-1">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-3.5 text-[#79907b]"
                  />
                  <span className="sr-only">Search staff</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or staff ID"
                    className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] py-3 pl-10 pr-3 text-sm"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter monthly staff results</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as typeof filter)}
                    className="rounded-xl border border-[#d8e2d5] bg-white px-3 py-3 text-sm"
                  >
                    <option value="all">All staff</option>
                    <option value="late">Late arrivals</option>
                    <option value="open">Open sessions</option>
                    <option value="overlap">Overlapping sessions</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 divide-y divide-[#e7ede4]">
                {visible.map((item) => (
                  <details key={item.staff.id} className="group py-5">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 [&::-webkit-details-marker]:hidden">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6e8] font-black text-[#386f40]">
                        {(item.staff.full_name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{item.staff.full_name || "Unnamed staff"}</p>
                        <p className="mt-1 text-xs text-[#718172]">
                          {item.staff.staff_id || "No staff ID"} ·{" "}
                          {item.staff.position ||
                            item.staff.department ||
                            item.staff.status ||
                            "Staff"}
                        </p>
                        <p className="mt-2 text-xs font-medium text-[#607465]">
                          {item.days.length} days with scans · {item.completed} completed sessions ·{" "}
                          {workDuration(item.minutes)} recorded work · {item.open} open
                          {item.overlapping > 0 ? ` · ${item.overlapping} overlapping` : ""}
                        </p>
                      </div>
                      {item.late > 0 && (
                        <span className="rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                          {item.late} late
                        </span>
                      )}
                      {item.overlapping > 0 && (
                        <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                          {item.overlapping} overlapping
                        </span>
                      )}
                      <span className="shrink-0 text-sm font-bold text-[#356942]">
                        Daily details ↓
                      </span>
                    </summary>
                    <div className="mt-4 space-y-2 pl-0 sm:pl-16">
                      {item.days.length === 0 && (
                        <p className="rounded-xl bg-[#f8faf6] p-4 text-xs text-[#748276]">
                          No QR sessions recorded for this staff member in the selected month.
                          Verify missed-scan reports separately.
                        </p>
                      )}
                      {item.days.map((day) => {
                        const duration = recordedWorkMinutes(day.scans);
                        return (
                          <div
                            key={day.date}
                            className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 text-xs ${day.late ? "border-red-300 bg-red-50 text-red-800" : "border-[#e2e9dd] bg-[#f8faf6] text-[#526756]"}`}
                          >
                            <span className="font-black">{day.date}</span>
                            <span>First in {time(day.firstIn)}</span>
                            <span>· {workDuration(duration.minutes)} completed</span>
                            {duration.open > 0 && <span>· {duration.open} open</span>}
                            {duration.invalid > 0 && <span>· {duration.invalid} invalid</span>}
                            {duration.overlapping > 0 && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 font-black text-amber-900">
                                {duration.overlapping} overlapping · review scans
                              </span>
                            )}
                            {day.late && (
                              <span className="rounded-full bg-red-100 px-2 py-1 font-black">
                                LATE
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
                {visible.length === 0 && (
                  <p className="py-10 text-center text-sm text-[#748276]">
                    No staff match these filters.
                  </p>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5">
                <p className="text-xs text-[#748276]">
                  Showing {visible.length} of {summaries.length} staff records · {month}
                </p>
                <a
                  href="/management-staff"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-xs font-bold text-white"
                >
                  Daily attendance <ArrowRight size={15} />
                </a>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
