import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  isLateArrival,
  lateRuleApplies,
  recordedWorkMinutes,
  workDuration,
  type StaffScan,
} from "@/lib/staff-attendance-rules";

export const Route = createFileRoute("/management-attendance-export")({
  component: AttendanceExport,
});
type Staff = {
  id: string;
  staff_id: string | null;
  full_name: string | null;
  position: string | null;
  status: string | null;
};
type StaffDay = { date: string; scans: StaffScan[] };
type StaffSummary = {
  person: Staff;
  days: StaffDay[];
  minutes: number;
  late: number;
  open: number;
  invalid: number;
  completed: number;
};
const ZONE = "Africa/Lagos";
const BATCH = 500;
function lagosDate(instant: Date | string) {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function nextMonth(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}
function lagosTime(iso: string | null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
/** Select the latest valid completed check-out by timestamp, not by clock-in order. */
function latestCompletedClockOut(records: StaffScan[]): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const scan of records) {
    const start = Date.parse(scan.checked_in_at);
    const end = scan.checked_out_at ? Date.parse(scan.checked_out_at) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    if (end > latestTime) {
      latestTime = end;
      latest = scan.checked_out_at;
    }
  }
  return latest;
}
async function fetchPages<T>(
  table: "staff_profiles" | "staff_attendance",
  select: string,
  month?: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += BATCH) {
    let query = supabase.from(table).select(select);
    if (month)
      query = query
        .gte("checked_in_at", `${month}-01T00:00:00+01:00`)
        .lt("checked_in_at", `${nextMonth(month)}-01T00:00:00+01:00`);
    const { data, error } = await query
      .order(month ? "checked_in_at" : "id", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < BATCH) return rows;
  }
}
// Quote every CSV field and neutralize spreadsheet formulas in user-entered names and IDs.
function csvCell(value: unknown): string {
  const text = String(value ?? "")
    .replace(/[\r\n\t\u0000-\u001f\u007f]/g, " ")
    .trim();
  const safe = /^[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
function makeCsv(rows: unknown[][]): string {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
function saveCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob([makeCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AttendanceExport() {
  const [month, setMonth] = useState(() => lagosDate(new Date()).slice(0, 7));
  const [staff, setStaff] = useState<Staff[]>([]);
  const [scans, setScans] = useState<StaffScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setAuthorized(false);
      setStaff([]);
      setScans([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Please sign in through the Staff Portal.");
        const { data: user, error: userError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (userError) throw userError;
        if (
          !user?.active ||
          !["admin", "owner", "manager"].includes(String(user.role || "").toLowerCase())
        )
          throw Error("Only active management accounts can export staff attendance.");
        const [people, attendance] = await Promise.all([
          fetchPages<Staff>("staff_profiles", "id,staff_id,full_name,position,status"),
          fetchPages<StaffScan>(
            "staff_attendance",
            "id,staff_profile_id,checked_in_at,checked_out_at",
            month,
          ),
        ]);
        if (!cancelled) {
          setStaff(people);
          setScans(attendance);
          setAuthorized(true);
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to load attendance records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month, reload]);
  const summaries = useMemo((): StaffSummary[] => {
    const grouped = new Map<string, Map<string, StaffScan[]>>();
    for (const scan of scans) {
      const date = lagosDate(scan.checked_in_at);
      if (!date || date.slice(0, 7) !== month) continue;
      if (!grouped.has(scan.staff_profile_id)) grouped.set(scan.staff_profile_id, new Map());
      const dates = grouped.get(scan.staff_profile_id)!;
      const existing = dates.get(date) || [];
      existing.push(scan);
      dates.set(date, existing);
    }
    return staff
      .map((person) => {
        const dates = grouped.get(person.id) || new Map<string, StaffScan[]>();
        const days = Array.from(dates, ([date, records]) => ({ date, scans: records })).sort(
          (a, b) => a.date.localeCompare(b.date),
        );
        const durations = recordedWorkMinutes(days.flatMap((day) => day.scans));
        return {
          person,
          days,
          minutes: durations.minutes,
          completed: durations.completed,
          open: durations.open,
          invalid: durations.invalid,
          late: days.filter((day) =>
            isLateArrival(person.full_name, day.date, day.scans[0]?.checked_in_at || null),
          ).length,
        };
      })
      .sort((a, b) => (a.person.full_name || "").localeCompare(b.person.full_name || ""));
  }, [staff, scans, month]);
  function summaryExport() {
    if (!authorized || loading) return;
    const rows: unknown[][] = [
      [
        "Reporting month (Lagos)",
        "Staff ID",
        "Staff name",
        "Position",
        "Profile status",
        "Days with QR records",
        "Late days (exceptions applied)",
        "Completed sessions",
        "Worked minutes (completed only)",
        "Worked time",
        "Open sessions",
        "Invalid sessions",
        "Record verification",
      ],
    ];
    summaries.forEach(({ person, days, late, completed, minutes, open, invalid }) =>
      rows.push([
        month,
        person.staff_id || "",
        person.full_name || "",
        person.position || "",
        person.status || "",
        days.length,
        late,
        completed,
        minutes,
        workDuration(minutes),
        open,
        invalid,
        days.length
          ? "QR records only; review missed scans separately"
          : "No QR records; attendance unverified",
      ]),
    );
    saveCsv(`superplus-staff-monthly-summary-${month}.csv`, rows);
  }
  function detailExport() {
    if (!authorized || loading) return;
    const rows: unknown[][] = [
      [
        "Date (Lagos)",
        "Staff ID",
        "Staff name",
        "First clock-in (Lagos)",
        "Last completed clock-out (Lagos)",
        "Punctuality (recorded)",
        "Completed sessions",
        "Worked minutes (completed only)",
        "Worked time",
        "Open sessions",
        "Invalid sessions",
        "Review note",
      ],
    ];
    summaries.forEach(({ person, days }) =>
      days.forEach(({ date, scans: records }) => {
        const stats = recordedWorkMinutes(records);
        const lastCompletedClockOut = latestCompletedClockOut(records);
        const punctuality = !lateRuleApplies(person.full_name, date)
          ? "Exempt / Sunday"
          : isLateArrival(person.full_name, date, records[0]?.checked_in_at || null)
            ? "Late"
            : "On time";
        rows.push([
          date,
          person.staff_id || "",
          person.full_name || "",
          lagosTime(records[0]?.checked_in_at || null),
          lagosTime(lastCompletedClockOut),
          punctuality,
          stats.completed,
          stats.minutes,
          workDuration(stats.minutes),
          stats.open,
          stats.invalid,
          stats.open || stats.invalid || stats.overlapping
            ? "Review open/invalid/overlapping sessions; not a payroll determination"
            : "Recorded QR sessions only",
        ]);
      }),
    );
    saveCsv(`superplus-staff-daily-breakdown-${month}.csv`, rows);
  }
  const days = summaries.reduce((count, summary) => count + summary.days.length, 0);
  const late = summaries.reduce((count, summary) => count + summary.late, 0);
  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-9 text-[#16221c] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a
          href="/management-staff-monthly"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"
        >
          <ArrowLeft size={16} /> Monthly attendance report
        </a>
        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#62905b]">
              Super Plus / Management
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Attendance exports
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">
              Download monthly QR attendance summaries and daily work-time details as CSV files for
              management review.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setReload((count) => count + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {loading && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]">
            <Loader2 size={19} className="animate-spin" /> Checking management access and loading
            complete QR records…
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
              <ShieldCheck size={21} className="mt-0.5 shrink-0" />
              <p>
                <strong>Confidential management exports.</strong> Files contain staff names and
                attendance; keep them private. All times are Lagos local time. Only completed QR
                sessions contribute to worked hours. Unfinished/invalid sessions are explicitly
                marked, and no QR record never means an automatic absence. Late indicators follow
                the existing 7:30 AM Monday–Saturday rule and named exemptions. Exporting never
                changes salary or attendance records.
              </p>
            </div>
            <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-6 sm:p-8">
              <label className="block text-xs font-bold text-[#607465]">
                <span className="mb-2 block">Reporting month · Lagos</span>
                <input
                  type="month"
                  value={month}
                  max={lagosDate(new Date()).slice(0, 7)}
                  onChange={(event) => {
                    if (
                      /^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) &&
                      event.target.value <= lagosDate(new Date()).slice(0, 7)
                    )
                      setMonth(event.target.value);
                  }}
                  className="rounded-xl border border-[#d8e2d5] px-4 py-3 text-sm"
                />
              </label>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Staff profiles", value: staff.length, icon: Users },
                  { label: "Staff-days with QR records", value: days, icon: Clock3 },
                  { label: "Recorded late days", value: late, icon: FileSpreadsheet },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-[#e2e9dd] bg-[#f8faf6] p-4">
                    <div className="flex justify-between text-xs font-bold text-[#607465]">
                      <span>{label}</span>
                      <Icon size={18} />
                    </div>
                    <p className="mt-4 text-3xl font-black tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col rounded-2xl border border-[#dbe6d6] p-5">
                  <FileSpreadsheet size={24} className="text-[#376c40]" />
                  <h2 className="mt-4 text-lg font-black">Monthly staff summary</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#647468]">
                    One row per staff member: recorded days, late days, completed hours, open and
                    invalid sessions. Includes staff without QR records, clearly marked unverified.
                  </p>
                  <button
                    type="button"
                    onClick={summaryExport}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-sm font-black text-white"
                  >
                    <Download size={17} /> Download summary CSV
                  </button>
                </div>
                <div className="flex flex-col rounded-2xl border border-[#dbe6d6] p-5">
                  <Clock3 size={24} className="text-[#376c40]" />
                  <h2 className="mt-4 text-lg font-black">Daily QR breakdown</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#647468]">
                    One row per staff member per day with recorded scans, first arrival, last
                    completed clock-out, punctuality, completed hours and exceptions.
                  </p>
                  <button
                    type="button"
                    onClick={detailExport}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-sm font-black text-white"
                  >
                    <Download size={17} /> Download daily CSV
                  </button>
                </div>
              </div>
              <p className="mt-5 text-xs leading-6 text-[#748276]">
                CSV opens in Excel, Numbers or Google Sheets. Exports include only records loaded
                for this selected month; review missed-scan reports and source entries before
                payroll decisions.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
