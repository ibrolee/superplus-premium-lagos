import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Flame,
  Fuel,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";
import { loadFinanceMonth } from "@/lib/finance-data";
import {
  EXPENSE_CATEGORIES,
  FINANCE_START_MONTH,
  monthlyPayrollCosts,
  operatingResult,
  type Expense,
  type ExpenseCategory,
} from "@/lib/monthly-finance";
import { lagosToday } from "@/lib/pt-payroll";
import { getUserErrorMessage } from "@/lib/user-error";

export const Route = createFileRoute("/management-expenses")({ component: ExpensesAndProfit });
const categoryIcons = {
  internet: Wifi,
  electricity: Zap,
  petrol: Fuel,
  gas: Flame,
  membership_cards: CreditCard,
  other: Receipt,
};
const categoryNames = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));
const money = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value + "T12:00:00Z"));
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value + "T12:00:00Z"));
const field =
  "mt-2 w-full min-w-0 rounded-xl border border-[#d5e0d0] bg-white px-4 py-3 text-base text-[#193b2a] outline-none focus:border-[#548b4c] disabled:opacity-50";
const DESCRIPTION_LIMIT = 10000;
type Draft = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
};
function blankDraft(month: string, today: string): Draft {
  return {
    id: crypto.randomUUID(),
    expense_date: month === today.slice(0, 7) ? today : month + "-01",
    category: "internet",
    description: "",
    amount: "",
  };
}
function exportReport(month: string, rows: string[][]) {
  const cell = (value: string) =>
    '"' + (/^[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "super-plus-finance-" + month + ".csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExpensesAndProfit() {
  const today = lagosToday();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [data, setData] = useState<Awaited<ReturnType<typeof loadFinanceMonth>> | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0),
    [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => blankDraft(month, today));
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState<ExpenseCategory | "all">("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the admin portal.");
        const { data: staff, error: staffError } = await supabase
          .from("staff_users")
          .select("role,active")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle();
        if (staffError) throw staffError;
        if (!staff?.active || !["admin", "owner"].includes(String(staff.role || "").toLowerCase()))
          throw Error("Expenses and profit are available to active admin and owner accounts.");
        if (live) setAccess("allowed");
      } catch (cause) {
        if (live) {
          setAccess("denied");
          setError(getUserErrorMessage(cause, "Unable to verify admin access."));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (access !== "allowed") return;
    let live = true;
    setLoading(true);
    setData(null);
    setError("");
    void loadFinanceMonth(month)
      .then((result) => {
        if (live) setData(result);
      })
      .catch((cause) => {
        if (live) setError(getUserErrorMessage(cause, "Unable to load this month's finances."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [access, month, reload]);
  const payroll = useMemo(
    () => (data ? monthlyPayrollCosts(data.payroll, month, today) : null),
    [data, month, today],
  );
  const result =
    data && payroll
      ? operatingResult(
          Number(data.finance.revenue),
          Number(data.finance.expense_total),
          payroll.total,
        )
      : null;
  const canCalculate =
    !!data &&
    !!payroll &&
    data.finance.revenue_complete &&
    data.finance.foreign_revenue_count === 0 &&
    payroll.issues.length === 0;
  const expenses = useMemo(
    () =>
      (data?.finance.expenses || []).filter(
        (e) =>
          (filter === "all" || e.category === filter) &&
          e.description.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data, filter, search],
  );
  const visible = expenses.slice(page * 15, page * 15 + 15);
  const provisional = payroll?.estimated;
  const disabled = !!busy || loading;
  function openNew() {
    setEditing(null);
    setDraft(blankDraft(month, today));
    setFormOpen(true);
    setError("");
    setNotice("");
  }
  function edit(expense: Expense) {
    setEditing(expense);
    setDraft({
      id: expense.id,
      expense_date: expense.expense_date,
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || access !== "allowed") return;
    if (draft.description.length > DESCRIPTION_LIMIT) {
      setError("Keep the expense description within 10,000 characters.");
      return;
    }
    const expenseDate = new Date(draft.expense_date + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.expense_date) ||
      !Number.isFinite(expenseDate.getTime()) ||
      expenseDate.toISOString().slice(0, 10) !== draft.expense_date ||
      draft.expense_date < FINANCE_START_MONTH + "-01" ||
      draft.expense_date > today
    ) {
      setError("Choose an expense date from 1 October 2026 to today.");
      return;
    }
    const amount = Number(draft.amount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000000 ||
      !/^\d+(?:\.\d{1,2})?$/.test(draft.amount) ||
      !draft.description.trim() ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month < FINANCE_START_MONTH ||
      month > today.slice(0, 7)
    ) {
      setError(
        "Choose a report month from October 2026 to the current month, and enter a description and a positive expense amount with up to two decimal places.",
      );
      return;
    }
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const values = {
        expense_date: draft.expense_date,
        category: draft.category,
        description: draft.description.trim(),
        amount,
      };
      const query = editing
        ? supabase
            .from("gym_expenses")
            .update(values)
            .eq("id", editing.id)
            .eq("updated_at", editing.updated_at)
            .is("voided_at", null)
        : supabase.from("gym_expenses").insert({ id: draft.id, ...values });
      const { data: saved, error: saveError } = await query.select("id").maybeSingle();
      if (saveError)
        throw Error(
          saveError.code === "23505"
            ? "This expense is already recorded. Refresh the list before entering it again."
            : saveError.message,
        );
      if (!saved)
        throw Error("This expense changed elsewhere. Refresh the list before editing it again.");
      setNotice(
        editing
          ? "Expense updated. The monthly totals will refresh."
          : "Expense recorded. The monthly totals will refresh.",
      );
      setFormOpen(false);
      setEditing(null);
      setMonth(draft.expense_date.slice(0, 7));
      setReload((v) => v + 1);
      setPage(0);
    } catch (cause) {
      setError(getUserErrorMessage(cause, "Unable to save expense."));
    } finally {
      setBusy("");
    }
  }
  async function remove(expense: Expense) {
    if (
      busy ||
      !window.confirm(
        "Remove " +
          expense.description +
          " (" +
          money(Number(expense.amount)) +
          ") from expenses? The record will be retained as removed.",
      )
    )
      return;
    setBusy(expense.id);
    setError("");
    setNotice("");
    try {
      const { data: removed, error: removeError } = await supabase
        .from("gym_expenses")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", expense.id)
        .eq("updated_at", expense.updated_at)
        .is("voided_at", null)
        .select("id")
        .maybeSingle();
      if (removeError) throw removeError;
      if (!removed) throw Error("This expense changed elsewhere. Refresh and try again.");
      if (editing?.id === expense.id) {
        setEditing(null);
        setFormOpen(false);
      }
      setNotice("Expense removed from totals.");
      setPage(0);
      setReload((v) => v + 1);
    } catch (cause) {
      setError(getUserErrorMessage(cause, "Unable to remove expense."));
    } finally {
      setBusy("");
    }
  }
  function download() {
    if (!data || !payroll || !result) return;
    exportReport(month, [
      ["Super Plus Fitness · Monthly finance report", month],
      [
        "Report status",
        !canCalculate ? "Needs review" : provisional ? "Provisional" : "Recorded payroll",
      ],
      ["Metric", "Amount (NGN)"],
      ["Revenue collected", String(data.finance.revenue)],
      ["Operating expenses", String(data.finance.expense_total)],
      ["Gross staff salaries", String(payroll.salary)],
      ["Coach commissions", String(payroll.pt)],
      ["Total payroll cost", String(payroll.total)],
      [
        "Operating profit / loss",
        canCalculate ? String(result.profit) : "Unavailable until issues are resolved",
      ],
      ["", ""],
      ["Expense date", "Category", "Description", "Expense amount (NGN)"],
      ...data.finance.expenses.map((e) => [
        e.expense_date,
        categoryNames[e.category] || e.category,
        e.description,
        String(e.amount),
      ]),
      ["", ""],
      ["Payroll", "Gross cost (NGN)", "Paid (NGN)", "Basis"],
      ...[...payroll.salaries, ...payroll.coachRows].map((r) => [
        r.name,
        String(r.amount),
        String(r.paid),
        r.estimated ? "Estimate" : "Saved record",
      ]),
    ]);
  }
  return (
    <AdminWorkspaceShell
      title="Expenses & profit"
      subtitle="October 2026 onward · Running costs, payroll and monthly results."
      active="/management-expenses"
    >
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <label className="text-xs font-bold text-[#536f55]">
          Report month
          <input
            type="month"
            min={FINANCE_START_MONTH}
            max={today.slice(0, 7)}
            value={month}
            disabled={!!busy}
            onChange={(e) => {
              if (e.target.value >= FINANCE_START_MONTH && e.target.value <= today.slice(0, 7)) {
                setMonth(e.target.value);
                setPage(0);
                setFormOpen(false);
                setEditing(null);
                setNotice("");
              }
            }}
            className={field}
          />
        </label>
        {access === "allowed" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setReload((v) => v + 1)}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-40"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              disabled={disabled || !data}
              onClick={download}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-40"
            >
              <Download size={16} />
              Export
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <Plus size={18} />
              Add expense
            </button>
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800"
        >
          <CheckCircle2 size={17} />
          {notice}
        </p>
      )}
      {(access === "checking" || loading) && (
        <p role="status" className="mt-6 rounded-2xl border bg-white p-6 text-sm">
          <Loader2 className="mr-2 inline animate-spin" size={17} />
          {access === "checking"
            ? "Checking admin access…"
            : "Loading expenses, revenue and payroll…"}
        </p>
      )}
      {access === "allowed" && formOpen && (
        <section
          aria-labelledby="expense-form-title"
          className="mt-5 rounded-2xl border border-[#ccddc4] bg-white p-5 sm:p-7"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="expense-form-title" className="flex items-center gap-2 text-xl font-black">
              <Receipt size={21} />
              {editing ? "Edit expense" : "Record an expense"}
            </h2>
            <button
              type="button"
              aria-label="Close expense form"
              disabled={!!busy}
              onClick={() => setFormOpen(false)}
              className="rounded-lg p-2 hover:bg-[#edf6e7]"
            >
              <X size={20} />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#647468]">
            This expense will be included in the month of its selected date. Staff salaries
            and coach commissions are included automatically from payroll.
          </p>
          <form onSubmit={(e) => void save(e)} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Expense date
              <input
                type="date"
                required
                min={FINANCE_START_MONTH + "-01"}
                max={today}
                value={draft.expense_date}
                disabled={!!busy}
                onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Category
              <select
                value={draft.category}
                disabled={!!busy}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as ExpenseCategory })
                }
                className={field}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Description
              <textarea
                required
                rows={10}
                maxLength={DESCRIPTION_LIMIT}
                value={draft.description}
                disabled={!!busy}
                placeholder="e.g. October internet subscription"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={field + " resize-y"}
              />
              <span className="mt-1 block text-xs font-normal text-[#647468]">
                {draft.description.length.toLocaleString()} / 10,000 characters
              </span>
            </label>
            <label className="text-sm font-bold">
              Expense amount (₦)
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="100000000"
                step="0.01"
                required
                disabled={!!busy}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="0"
                className={field}
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={!!busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#193b2a] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy === "save" ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={17} />
                )}
                {editing ? "Save changes" : "Record expense"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setFormOpen(false)}
                className="rounded-xl border px-5 py-3 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {data && payroll && result && (
        <>
          <section
            className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Monthly financial summary"
          >
            {[
              {
                label: "Revenue collected",
                value: money(Number(data.finance.revenue)),
                note: data.finance.revenue_count + " successful payments",
                icon: ArrowDownLeft,
              },
              {
                label: "Operating expenses",
                value: money(Number(data.finance.expense_total)),
                note: data.finance.expense_count + " recorded expenses",
                icon: ArrowUpRight,
              },
              {
                label: "Salaries + commissions",
                value: money(payroll.total),
                note: "Full payroll cost for this month",
                icon: Wallet,
              },
            ].map(({ label, value, note, icon: Icon }) => (
              <article
                key={label}
                className="min-w-0 rounded-2xl border border-[#dce8d9] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2 text-[#607663]">
                  <p className="text-xs font-bold">{label}</p>
                  <Icon size={19} />
                </div>
                <p className="mt-4 break-words text-2xl font-black tabular-nums">{value}</p>
                <p className="mt-2 text-xs text-[#647468]">{note}</p>
              </article>
            ))}
            <article
              className={
                "min-w-0 rounded-2xl p-5 text-white " +
                (canCalculate && result.profit < 0 ? "bg-[#823d38]" : "bg-[#193b2a]")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-white/75">
                  {canCalculate && result.profit < 0 ? "Operating loss" : "Operating profit"}
                  {provisional ? " · provisional" : ""}
                </p>
                <TrendingUp size={19} />
              </div>
              <p className="mt-4 break-words text-2xl font-black tabular-nums">
                {canCalculate ? money(result.profit) : "Needs review"}
              </p>
              <p className="mt-2 text-xs text-white/75">
                {canCalculate && result.margin !== null
                  ? result.margin.toFixed(1) + "% of collected revenue"
                  : "Revenue − expenses − payroll"}
              </p>
            </article>
          </section>
          <p className="mt-3 text-xs leading-6 text-[#647468]">
            Revenue collected − recorded operating expenses − gross salaries and coach commissions
            for{" "}
            {new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(
              new Date(month + "-01T12:00:00Z"),
            )}
            . Salaries paid next month still belong to this month; advances are part of salary. Add
            all running costs for a complete result.
          </p>
          {(provisional || !canCalculate) && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {provisional && (
                <p>
                  <strong>Provisional payroll.</strong> Unsaved salary amounts use current staff
                  salary settings; coach commissions can change until payouts are saved and locked.
                </p>
              )}
              {!data.finance.revenue_complete && (
                <p>
                  Revenue reporting starts{" "}
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeZone: "Africa/Lagos",
                  }).format(new Date(data.finance.revenue_baseline))}
                  ; this month's income is incomplete.
                </p>
              )}
              {data.finance.foreign_revenue_count > 0 && (
                <p>
                  Some revenue is in another currency and needs review before calculating naira
                  profit.
                </p>
              )}
              {payroll.issues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
              <a
                href="/management-salary-payments"
                className="mt-2 inline-flex items-center gap-1 font-bold underline"
              >
                Review salary payments <ArrowUpRight size={15} />
              </a>
            </div>
          )}
          <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-[#dce8d9] bg-white p-5 sm:p-6">
              <h2 className="text-lg font-black">Expenses by category</h2>
              <div className="mt-5 space-y-4">
                {EXPENSE_CATEGORIES.map((c) => {
                  const Icon = categoryIcons[c.value];
                  const amount = Number(data.finance.category_totals[c.value] || 0);
                  const share =
                    Number(data.finance.expense_total) > 0
                      ? (amount / Number(data.finance.expense_total)) * 100
                      : 0;
                  return (
                    <div key={c.value}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-bold">
                          <Icon size={17} className="text-[#548b4c]" />
                          {c.label}
                        </span>
                        <strong className="tabular-nums">{money(amount)}</strong>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf3e9]">
                        <div
                          className="h-full rounded-full bg-[#5a914f]"
                          style={{ width: share + "%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#dce8d9] bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Wallet size={20} />
                Payroll breakdown
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ["Gross staff salaries", payroll.salary],
                  ["Coach PT / contract commissions", payroll.pt],
                  ["Total payroll cost", payroll.total],
                  ["Already paid, including advances", payroll.paid],
                  ["Still to pay", payroll.outstanding],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="flex flex-wrap justify-between gap-2">
                    <dt className="text-[#647468]">{label}</dt>
                    <dd className="font-black tabular-nums">{money(Number(amount))}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-5 border-t pt-4">
                <summary className="cursor-pointer text-sm font-bold">
                  View salary and commission costs
                </summary>
                <div className="mt-3 space-y-3">
                  {[...payroll.salaries, ...payroll.coachRows]
                    .filter((r) => r.amount > 0 || r.missing)
                    .map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-3 text-xs">
                        <span>
                          {r.name}
                          <span className="mt-1 block text-[#647468]">
                            {r.missing ? "Needs review" : r.estimated ? "Estimate" : "Saved record"}
                          </span>
                        </span>
                        <strong className="shrink-0">{money(r.amount)}</strong>
                      </div>
                    ))}
                </div>
              </details>
              <a
                href="/management-salary-payments"
                className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#38673e] underline"
              >
                Open salary payments <ArrowUpRight size={15} />
              </a>
            </div>
          </section>
          <section className="mt-6 rounded-2xl border border-[#dce8d9] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Receipt size={21} />
                Expense history
              </h2>
              <span className="text-xs text-[#647468]">{expenses.length} matching records</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search expense descriptions</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Search expense descriptions"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className={field}
                />
              </label>
              <label>
                <span className="sr-only">Filter expense category</span>
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as ExpenseCategory | "all");
                    setPage(0);
                  }}
                  className={field}
                >
                  <option value="all">All categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {visible.length === 0 ? (
              <div className="mt-5 rounded-xl bg-[#f5f8f2] p-7 text-center">
                <Receipt size={30} className="mx-auto text-[#65905c]" />
                <h3 className="mt-3 font-black">
                  {data.finance.expense_count ? "No matching expenses" : "No expenses recorded yet"}
                </h3>
                <p className="mt-2 text-sm text-[#647468]">
                  {data.finance.expense_count
                    ? "Try another category or search."
                    : "Add October running costs to begin tracking the gym's monthly result."}
                </p>
                {!data.finance.expense_count && (
                  <button
                    type="button"
                    onClick={openNew}
                    className="mt-4 rounded-xl bg-[#193b2a] px-4 py-3 text-sm font-bold text-white"
                  >
                    Add first expense
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 divide-y divide-[#edf2e9]">
                {visible.map((e) => {
                  const Icon = categoryIcons[e.category] || Receipt;
                  return (
                    <article key={e.id} className="flex flex-wrap items-start gap-3 py-4">
                      <span className="rounded-xl bg-[#edf6e7] p-3 text-[#548b4c]">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words text-sm font-black">
                          {e.description}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#647468]">
                          <span>{categoryNames[e.category]}</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays size={12} />
                            {dateLabel(e.expense_date)}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <strong className="text-base tabular-nums">
                          {money(Number(e.amount))}
                        </strong>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label={"Edit " + e.description}
                            disabled={disabled}
                            onClick={() => edit(e)}
                            className="rounded-lg border p-2 text-[#548b4c] disabled:opacity-40"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={"Remove " + e.description}
                            disabled={disabled}
                            onClick={() => void remove(e)}
                            className="rounded-lg border p-2 text-red-700 disabled:opacity-40"
                          >
                            {busy === e.id ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {expenses.length > 15 && (
              <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((v) => v - 1)}
                  className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(expenses.length / 15)}
                </span>
                <button
                  type="button"
                  disabled={(page + 1) * 15 >= expenses.length}
                  onClick={() => setPage((v) => v + 1)}
                  className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </AdminWorkspaceShell>
  );
}
