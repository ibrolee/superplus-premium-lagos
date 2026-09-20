import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/management-payroll")({ component: ManagementPayroll });
type Staff = {
  id: string;
  full_name: string | null;
  staff_id: string | null;
  position: string | null;
  status: string | null;
};
type Salary = {
  id: string;
  staff_profile_id: string;
  amount: number;
  currency: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  status: string;
  created_at: string;
};
type Filter = "all" | "paid" | "pending" | "cancelled";
const PAGE_SIZE = 500;
const LIST_SIZE = 20;
function lagosDay(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const get = (kind: string) => parts.find((part) => part.type === kind)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function displayDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : new Intl.DateTimeFormat("en-NG", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}
function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}
async function readAll<T>(
  table: "staff_profiles" | "staff_salary_records",
  columns: string,
): Promise<T[]> {
  const output: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    output.push(...batch);
    if (batch.length < PAGE_SIZE) return output;
  }
}
function ManagementPayroll() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [month, setMonth] = useState(() => lagosDay(new Date()).slice(0, 7));
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setAuthorized(false);
      setStaff([]);
      setSalaries([]);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user)
          throw Error("Sign in through the Staff Portal to view salary records.");
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
          throw Error("Only active management accounts can view salary records.");
        const [profiles, records] = await Promise.all([
          readAll<Staff>("staff_profiles", "id,full_name,staff_id,position,status"),
          readAll<Salary>(
            "staff_salary_records",
            "id,staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,created_at",
          ),
        ]);
        if (!cancelled) {
          setStaff(profiles);
          setSalaries(records);
          setAuthorized(true);
        }
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to load salary records.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload]);
  const staffById = useMemo(() => new Map(staff.map((person) => [person.id, person])), [staff]);
  // The filter is by record creation date, NOT by salary period or payment date. Never infer amounts owed from QR scans.
  const monthly = useMemo(
    () =>
      salaries.filter(
        (record) => month === "all" || lagosDay(record.created_at).slice(0, 7) === month,
      ),
    [salaries, month],
  );
  const totals = useMemo(() => {
    const grouped = new Map<
      string,
      { currency: string; paid: number; pending: number; cancelled: number; other: number }
    >();
    for (const record of monthly) {
      const currency = (record.currency || "NGN").toUpperCase();
      const entry = grouped.get(currency) || {
        currency,
        paid: 0,
        pending: 0,
        cancelled: 0,
        other: 0,
      };
      const amount = Number(record.amount);
      if (Number.isFinite(amount)) {
        if (record.status === "paid") entry.paid += amount;
        else if (record.status === "pending") entry.pending += amount;
        else if (record.status === "cancelled") entry.cancelled += amount;
        else entry.other += amount;
      }
      grouped.set(currency, entry);
    }
    return Array.from(grouped.values()).sort((a, b) => a.currency.localeCompare(b.currency));
  }, [monthly]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return monthly
      .filter((record) => {
        const person = staffById.get(record.staff_profile_id);
        return (
          (filter === "all" || record.status === filter) &&
          (!needle ||
            [person?.full_name, person?.staff_id, person?.position, record.status, record.id].some(
              (field) =>
                String(field || "")
                  .toLowerCase()
                  .includes(needle),
            ))
        );
      })
      .sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id),
      );
  }, [monthly, staffById, search, filter]);
  const pages = Math.max(1, Math.ceil(visible.length / LIST_SIZE));
  const currentPage = Math.min(page, pages);
  return (
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-8 text-[#16221c] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <a
              href="/management-operations"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#356942]"
            >
              <ArrowLeft size={16} /> Operations hub
            </a>
            <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#62905b]">
              Super Plus / Management
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Salary records</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#647468]">
              View previously recorded salary entries and payment statuses without changing payroll.
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
            <Loader2 size={19} className="animate-spin" /> Loading recorded salaries…
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
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />
              <p>
                <strong>Read-only ledger.</strong> Figures below sum recorded salary entries by
                their saved statuses, not verified bank transfers or calculated wages due. Month
                filter uses when each record was created in Lagos; pay periods and payment dates are
                shown separately. Missing QR scans never cause deductions here. For corrections and
                actual payroll management, use the original Staff Admin page.
              </p>
            </div>
            <section className="mt-7 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Salary ledger</h2>
                  <p className="mt-2 text-xs text-[#748276]">
                    {monthly.length} records in selected creation period · {staff.length} staff
                    profiles
                  </p>
                </div>
                <label className="text-xs font-bold text-[#607465]">
                  <span className="mb-2 block">Recorded month · Lagos</span>
                  <select
                    value={month}
                    onChange={(event) => {
                      setMonth(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-[#d8e2d5] bg-white px-4 py-3 text-sm"
                  >
                    <option value="all">All recorded months</option>
                    {Array.from(
                      new Set(salaries.map((item) => lagosDay(item.created_at).slice(0, 7))),
                    )
                      .sort()
                      .reverse()
                      .map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    {!salaries.some((item) => lagosDay(item.created_at).slice(0, 7) === month) && (
                      <option value={month}>{month}</option>
                    )}
                  </select>
                </label>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Recorded entries", value: monthly.length, icon: Banknote },
                  {
                    label: "Marked paid",
                    value: monthly.filter((entry) => entry.status === "paid").length,
                    icon: CheckCircle2,
                  },
                  {
                    label: "Marked pending",
                    value: monthly.filter((entry) => entry.status === "pending").length,
                    icon: Clock3,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-[#e2e9dd] bg-[#f8faf6] p-4">
                    <div className="flex justify-between">
                      <p className="text-xs font-bold text-[#607465]">{label}</p>
                      <Icon size={18} className="text-[#38673e]" />
                    </div>
                    <p className="mt-4 text-3xl font-black tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              {totals.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#607465]">
                    Recorded amounts by currency and status
                  </h3>
                  {totals.map((item) => (
                    <div
                      key={item.currency}
                      className="grid gap-3 rounded-2xl border border-[#e2e9dd] p-4 text-sm sm:grid-cols-3"
                    >
                      <div>
                        <p className="text-xs text-[#607465]">Marked paid · {item.currency}</p>
                        <p className="mt-1 font-black tabular-nums">
                          {money(item.paid, item.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#607465]">Marked pending</p>
                        <p className="mt-1 font-black tabular-nums">
                          {money(item.pending, item.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#607465]">Cancelled</p>
                        <p className="mt-1 font-black tabular-nums">
                          {money(item.cancelled, item.currency)}
                        </p>
                      </div>
                      {item.other !== 0 && (
                        <p className="text-xs text-[#607465] sm:col-span-3">
                          Other status totals: {money(item.other, item.currency)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="mt-6 rounded-[24px] border border-[#e1e8dd] bg-white p-5 sm:p-7">
              <div className="flex flex-wrap gap-3">
                <label className="relative min-w-0 flex-1">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-3.5 text-[#79907b]"
                  />
                  <span className="sr-only">Search salary records</span>
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search staff, ID or status"
                    className="w-full rounded-xl border border-[#d8e2d5] bg-[#f8faf6] py-3 pl-10 pr-3 text-sm"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter salary status</span>
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value as Filter);
                      setPage(1);
                    }}
                    className="rounded-xl border border-[#d8e2d5] bg-white px-3 py-3 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
              <div className="mt-5 divide-y divide-[#e7ede4]">
                {visible
                  .slice((currentPage - 1) * LIST_SIZE, currentPage * LIST_SIZE)
                  .map((record) => {
                    const person = staffById.get(record.staff_profile_id);
                    return (
                      <div key={record.id} className="flex flex-wrap items-start gap-4 py-5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6e8] font-black text-[#386f40]">
                          {(person?.full_name || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">
                            {person?.full_name || "Unknown staff"}{" "}
                            <span
                              className={`ml-1 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${record.status === "paid" ? "bg-green-100 text-green-800" : record.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-[#f0f2ed] text-[#637469]"}`}
                            >
                              {record.status || "Unknown"}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-[#718172]">
                            {person?.staff_id || "No staff ID"} · Created{" "}
                            {displayDate(lagosDay(record.created_at))}
                          </p>
                          <p className="mt-2 text-xs text-[#607465]">
                            Pay period: {displayDate(record.pay_period_start)} –{" "}
                            {displayDate(record.pay_period_end)} · Payment date:{" "}
                            {displayDate(record.payment_date)}
                          </p>
                        </div>
                        <strong className="text-sm tabular-nums sm:text-base">
                          {money(Number(record.amount || 0), record.currency || "NGN")}
                        </strong>
                      </div>
                    );
                  })}
                {visible.length === 0 && (
                  <p className="py-10 text-center text-sm text-[#748276]">
                    No salary records match the current filters.
                  </p>
                )}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7ede4] pt-5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <p className="text-xs text-[#748276]">
                  {visible.length} matching · page {currentPage} / {pages}
                </p>
                <button
                  type="button"
                  disabled={currentPage >= pages}
                  onClick={() => setPage((n) => n + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#d8e2d5] px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
              <a
                href="/staff-admin"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#193d2b] px-4 py-3 text-xs font-bold text-white"
              >
                Open original payroll tools <ArrowRight size={15} />
              </a>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
