import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-payroll-export")({ component: PayrollExport });
type Staff = {
  id: string;
  staff_id: string | null;
  full_name: string | null;
  position: string | null;
};
type Salary = {
  id: string;
  staff_profile_id: string;
  amount: number;
  currency: string | null;
  status: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  created_at: string;
};
const PAGE_SIZE = 500;
const LAGOS = "Africa/Lagos";
function lagosDate(value: string | Date): string {
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function lagosTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}
async function allRows<T>(
  table: "staff_profiles" | "staff_salary_records",
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
/** Quote CSV values and neutralise spreadsheet formulas in database-supplied strings. */
function csvCell(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return `"${value}"`;
  const text = String(value ?? "")
    .replace(/[\r\n\t\u0000-\u001f\u007f]/g, " ")
    .trim();
  const safe = /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, data: unknown[][]) {
  const text = "\ufeff" + data.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function PayrollExport() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [records, setRecords] = useState<Salary[]>([]);
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setAuthorized(false);
      setError("");
      setStaff([]);
      setRecords([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Please sign in through the Staff Portal first.");
        const { data: account, error: accountError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (accountError) throw accountError;
        if (
          !account?.active ||
          !["admin", "owner", "manager"].includes(String(account.role || "").toLowerCase())
        )
          throw Error("Only active management accounts can export salary records.");
        const [profiles, salaries] = await Promise.all([
          allRows<Staff>("staff_profiles", "id,staff_id,full_name,position"),
          allRows<Salary>(
            "staff_salary_records",
            "id,staff_profile_id,amount,currency,status,pay_period_start,pay_period_end,payment_date,created_at",
          ),
        ]);
        if (!cancelled) {
          setStaff(profiles);
          setRecords(salaries);
          setAuthorized(true);
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load salary records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const staffById = useMemo(() => new Map(staff.map((person) => [person.id, person])), [staff]);
  const months = useMemo(
    () =>
      [...new Set(records.map((item) => lagosDate(item.created_at).slice(0, 7)).filter(Boolean))]
        .sort()
        .reverse(),
    [records],
  );
  const statuses = useMemo(
    () => [...new Set(records.map((item) => item.status).filter(Boolean))].sort(),
    [records],
  );
  const matching = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records
      .filter((record) => {
        const person = staffById.get(record.staff_profile_id);
        return (
          (month === "all" || lagosDate(record.created_at).slice(0, 7) === month) &&
          (status === "all" || record.status === status) &&
          (!query ||
            [person?.full_name, person?.staff_id, person?.position, record.id].some((field) =>
              (field || "").toLowerCase().includes(query),
            ))
        );
      })
      .sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id),
      );
  }, [records, staffById, month, status, search]);
  const counts = useMemo(
    () =>
      matching.reduce(
        (tally, row) => {
          const state = row.status.toLowerCase();
          if (state === "paid") tally.paid++;
          else if (state === "pending") tally.pending++;
          else if (state === "cancelled") tally.cancelled++;
          return tally;
        },
        { paid: 0, pending: 0, cancelled: 0 },
      ),
    [matching],
  );
  function exportRecords() {
    if (!authorized || loading || matching.length === 0) return;
    const lines: unknown[][] = [
      [
        "Staff ID",
        "Staff name",
        "Position",
        "Salary record ID",
        "Amount (raw numeric)",
        "Currency",
        "Saved status (not bank-verified)",
        "Pay period start",
        "Pay period end",
        "Recorded payment date",
        "Record created date (Lagos)",
        "Record created time (Lagos)",
        "Record created timestamp (ISO)",
      ],
    ];
    matching.forEach((record) => {
      const person = staffById.get(record.staff_profile_id);
      const amount = Number(record.amount);
      lines.push([
        person?.staff_id || "",
        person?.full_name || "Unknown staff",
        person?.position || "",
        record.id,
        Number.isFinite(amount) ? amount : "",
        record.currency || "NGN",
        record.status,
        record.pay_period_start || "",
        record.pay_period_end || "",
        record.payment_date || "",
        lagosDate(record.created_at),
        lagosTime(record.created_at),
        record.created_at,
      ]);
    });
    downloadCsv(
      `superplus-salary-records-${month}-${status}${search.trim() ? "-searched" : ""}.csv`,
      lines,
    );
  }
  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-9 text-[#16221c] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a
          href="/management-payroll"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"
        >
          <ArrowLeft size={16} /> Salary records
        </a>
        <div className="mt-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#62905b]">
              Super Plus / Management
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Salary exports</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">
              Download existing recorded salary entries for confidential reconciliation. No payments
              are made here.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        {loading && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-[#607264]">
            <Loader2 size={19} className="animate-spin" /> Checking management access and loading
            salary records…
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
                <strong>Confidential, read-only export.</strong> Salary status reflects what was
                saved in the system; “paid” does not independently prove a bank transfer. The month
                is based on the record's creation date in Lagos, not the pay period or payment date.
                Downloads include staff names and amounts: keep them private. Attendance, payroll,
                and salary records are never modified by this export.
              </p>
            </div>
            <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-[#376c40]" size={25} />
                <div>
                  <h2 className="text-xl font-black">Salary ledger CSV</h2>
                  <p className="mt-1 text-xs text-[#748276]">
                    All matching rows, not just one screen of results.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#607465]">
                  Recorded month · Lagos
                  <select
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm"
                  >
                    <option value="all">All recorded months</option>
                    {months.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-[#607465]">
                  Saved status
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm"
                  >
                    <option value="all">All statuses</option>
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-xs font-bold text-[#607465]">
                Staff name or ID
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Optional search"
                  className="mt-2 block w-full rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm"
                />
              </label>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  { name: "Matching records", value: matching.length },
                  { name: "Marked paid", value: counts.paid },
                  { name: "Marked pending", value: counts.pending },
                  { name: "Cancelled", value: counts.cancelled },
                ].map((item) => (
                  <div key={item.name} className="rounded-xl bg-[#f4f8f1] p-4">
                    <p className="text-xs text-[#607465]">{item.name}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">
                      {item.value.toLocaleString("en-NG")}
                    </p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={!matching.length}
                onClick={exportRecords}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#193d2b] px-4 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={18} /> Download {matching.length.toLocaleString("en-NG")} salary
                records · CSV
              </button>
              <p className="mt-4 text-xs leading-6 text-[#748276]">
                Includes staff identification, raw amounts with currencies, saved statuses, pay
                periods, payment dates, and original record timestamps. CSV can open in Excel,
                Numbers or Google Sheets. Verify source records before making accounting decisions.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
