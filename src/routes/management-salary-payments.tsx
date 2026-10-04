import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Wallet } from "lucide-react";
import { AdminWorkspaceShell } from "@/components/admin/AdminWorkspaceShell";
import { supabase } from "@/lib/supabase";
import { calculatePtPayout, calendarDate, lagosToday, formatDate, formatMoney, type Trainer, type PtMembership, type Assignment, type Evaluation, type PtPayoutRun } from "@/lib/pt-payroll";

export const Route = createFileRoute("/management-salary-payments")({ component: SalaryPayments });
type Staff = { id: string; full_name: string; position: string | null; status: string };
type Setting = { staff_profile_id: string; current_monthly_salary: number; currency: string };
type Payment = { id: string; staff_profile_id: string; amount: number; currency: string; pay_period_start: string | null; pay_period_end: string | null; payment_date: string | null; scheduled_pay_date: string | null; status: string; payroll_kind: string | null; pt_payout_run_id: string | null; notes: string | null };
type Data = { staff: Staff[]; settings: Setting[]; payments: Payment[]; trainers: Trainer[]; memberships: PtMembership[]; assignments: Assignment[]; evaluations: Evaluation[]; runs: PtPayoutRun[] };
const empty: Data = { staff: [], settings: [], payments: [], trainers: [], memberships: [], assignments: [], evaluations: [], runs: [] };
// These are test/admin accounts, not employees on payroll.
const DUMMY_STAFF_IDS = new Set([
  "143517a5-46ec-4f57-85f0-a700c8ffbcd0", // Ibrahim Alli
  "48031602-21f1-4210-945e-2fefd83e6f52", // Super Plus Fitness Admin
]);
const excluded = (staff: Staff) => DUMMY_STAFF_IDS.has(staff.id) || /ifeanyi/i.test(staff.full_name);
const money = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
const cents = (amount: number) => Math.round(Number(amount) * 100) / 100;
async function readAll<T>(table: string, columns: string, ptOnly = false): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select(columns).order(table === "staff_salary_settings" ? "staff_profile_id" : table === "pt_assignments" || table === "pt_evaluations" ? "membership_id" : "id").range(offset, offset + 499);
    if (ptOnly) query = query.ilike("plan_name", "Personal Training%");
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
function SalaryPayments() {
  const [data, setData] = useState<Data>(empty);
  const [month, setMonth] = useState(() => lagosToday().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string | undefined>>({});
  const [adjusting, setAdjusting] = useState("");
  const today = lagosToday();
  const start = `${month}-01`;
  const parsed = new Date(start + "T12:00:00Z");
  const due = calendarDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1);
  const end = calendarDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    async function load() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw Error("Sign in through the Staff Portal first.");
        const { data: account, error: accountError } = await supabase.from("staff_users").select("role,active").eq("auth_user_id", auth.user.id).maybeSingle();
        if (accountError) throw accountError;
        if (!account?.active || !["admin", "owner"].includes(account.role)) throw Error("Salary payments are available to active admin and owner accounts.");
        const [staff, settings, payments, trainers, memberships, assignments, evaluations, runs] = await Promise.all([
          readAll<Staff>("staff_profiles", "id,full_name,position,status"),
          readAll<Setting>("staff_salary_settings", "staff_profile_id,current_monthly_salary,currency"),
          readAll<Payment>("staff_salary_records", "id,staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,scheduled_pay_date,status,payroll_kind,pt_payout_run_id,notes"),
          // pt_trainers has staff_profile_id as its key, rather than id.
          supabase.from("pt_trainers").select("staff_profile_id,display_name,active,sort_order").order("sort_order").then(({ data, error }) => { if (error) throw error; return (data || []) as Omit<Trainer, "staff_title">[]; }),
          readAll<PtMembership>("memberships", "id,member_id,plan_name,start_date,end_date,status,payment_status,created_at", true),
          readAll<Assignment>("pt_assignments", "membership_id,member_id,trainer_staff_profile_id,updated_at"),
          readAll<Evaluation>("pt_evaluations", "membership_id,member_id,trainer_staff_profile_id,overall_rating,submitted_at"),
          readAll<PtPayoutRun>("pt_semimonthly_payout_runs", "id,period_start,period_end,pay_date,auto_payout_pool,payout_pool,breakdown,status,financial_locked,paid_at,created_by,updated_at"),
        ]);
        if (!cancelled) {
          setData({ staff, settings, payments, memberships, assignments, evaluations, runs,
            trainers: trainers.filter((trainer) => !excluded(staff.find((person) => person.id === trainer.staff_profile_id) || { id: "", full_name: trainer.display_name, position: null, status: "" }))
              .map((trainer) => ({ ...trainer, staff_title: staff.find((person) => person.id === trainer.staff_profile_id)?.position || null })),
          });
          setAuthorized(true);
        }
      } catch (cause) { if (!cancelled) { setAuthorized(false); setError(cause instanceof Error ? cause.message : "Unable to load payroll."); } }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);
  const salaryRows = useMemo(() => data.staff.filter((staff) => staff.status === "approved" && !excluded(staff)).map((staff) => {
    const records = data.payments.filter((payment) => payment.staff_profile_id === staff.id && payment.pay_period_start === start && payment.pay_period_end === end && payment.status !== "cancelled" && payment.payroll_kind !== "pt_commission");
    const record = records[0];
    const setting = data.settings.find((setting) => setting.staff_profile_id === staff.id);
    return { staff, record, conflict: records.length > 1, amount: record ? Number(record.amount) : setting ? Number(setting.current_monthly_salary) : null,
      currency: record?.currency || setting?.currency || "NGN", paid: record?.status === "paid" };
  }), [data, start, end]);
  const ptPeriods = useMemo(() => [start, `${month}-16`].map((periodStart) => {
    const run = data.runs.find((run) => run.period_start === periodStart) || null;
    const calculation = calculatePtPayout({ trainers: data.trainers, memberships: data.memberships, evaluations: data.evaluations,
      assignmentMap: new Map(data.assignments.map((assignment) => [assignment.membership_id, assignment])),
      payoutPeriodStart: periodStart, payoutPool: overrides[periodStart] ?? null, payoutRuns: data.runs, selectedPayoutRun: run, today });
    const locked = run?.status === "paid" || run?.financial_locked === true;
    const dirty = run !== null && !locked && (Math.abs(Number(run.auto_payout_pool) - calculation.autoPool) > .01 || Math.abs(Number(run.payout_pool) - calculation.pool) > .01 || JSON.stringify(run.breakdown) !== JSON.stringify(calculation.rows));
    const override = overrides[periodStart];
    const invalid = override !== undefined && (!override.trim() || !Number.isFinite(Number(override)) || Number(override) < 0);
    const rows = calculation.rows.map((row) => ({ ...row, payment: data.payments.find((payment) => payment.pt_payout_run_id === run?.id && payment.staff_profile_id === row.trainer_staff_profile_id && payment.status === "paid") }));
    return { ...calculation, run, locked, dirty, invalid, rows };
  }), [data, month, start, today, overrides]);
  const totals = useMemo(() => {
    const byCurrency: Record<string, { salary: number; pt: number; paid: number; due: number }> = {};
    const entry = (currency: string) => byCurrency[currency] ||= { salary: 0, pt: 0, paid: 0, due: 0 };
    salaryRows.forEach((row) => { if (row.amount !== null && !row.conflict) { const total = entry(row.currency); total.salary += row.amount; if (row.paid) total.paid += row.amount; else total.due += row.amount; } });
    ptPeriods.forEach((period) => period.rows.forEach((row) => { const total = entry("NGN"); const amount = cents(row.recommended_payout); total.pt += amount; if (row.payment || period.run?.status === "paid") total.paid += amount; else total.due += amount; }));
    return Object.entries(byCurrency);
  }, [salaryRows, ptPeriods]);
  async function act(key: string, confirmation: string | null, action: () => PromiseLike<{ error: { message: string } | null }>) {
    if (loading || busy || (confirmation && !window.confirm(confirmation))) return;
    setBusy(key); setError(""); setMessage("");
    try {
      const { error } = await action();
      if (error) throw Error(error.message);
      setMessage("Saved. Payment history is updated for recorded payments.");
      setOverrides({}); setAdjusting(""); setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save payment."); }
    finally { setBusy(""); }
  }
  const disabled = loading || !!busy;
  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  return <AdminWorkspaceShell title="Salary payments" subtitle="Monthly staff salaries and twice-monthly coach PT payments." active="/management-salary-payments">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="text-xs font-bold">Salary month
        <input type="month" value={month} max={today.slice(0, 7)} disabled={disabled} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setOverrides({}); setAdjusting(""); setMessage(""); } }} className="mt-2 block rounded-xl border bg-white p-3 text-sm" />
      </label>
      <button disabled={disabled} onClick={() => setReload((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border bg-white p-3 text-xs font-bold disabled:opacity-40"><RefreshCw size={16} />Refresh</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {loading && <p role="status" className="mt-5 text-sm">Loading salaries and PT payments…</p>}
    {authorized && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{totals.map(([currency, total]) => <div key={currency} className="rounded-2xl bg-[#193b2a] p-5 text-white">
        <p className="text-xs font-bold text-white/70">Total outstanding · {currency}</p><p className="mt-1 text-3xl font-black">{money(total.due, currency)}</p>
        <p className="mt-3 text-xs leading-6 text-white/75">Monthly salary {money(total.salary, currency)} · PT {money(total.pt, currency)}<br />Marked paid {money(total.paid, currency)}</p>
      </div>)}</div>
      <p className="mt-3 text-xs leading-5 text-[#647468]">Current-month amounts are provisional until the period closes. Monthly salaries use saved staff salary settings. Coach Ifeanyi is excluded pending his contract.</p>
      <label className="mt-5 block"><span className="sr-only">Search staff</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff name" className="w-full rounded-xl border bg-white p-3 text-sm" /></label>
      <section className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-black"><Wallet size={20} />Monthly salaries</h2>
        <p className="mt-2 text-xs text-[#647468]">{formatDate(start)} – {formatDate(end)} · Pay date: {formatDate(due)}</p>
        <div className="mt-4 space-y-3">{salaryRows.filter((row) => matches(row.staff.full_name)).map((row) => <article key={row.staff.id} className="rounded-xl border bg-[#f8faf6] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{row.staff.full_name}</h3><p className="mt-1 text-xs text-[#647468]">{row.staff.position || "Staff"}</p></div><strong>{row.amount === null ? "Salary not set" : money(row.amount, row.currency)}</strong></div>
          {row.conflict ? <p className="mt-3 text-xs text-red-800">Multiple salary entries exist. Review payroll records before payment.</p> : row.paid ? <p className="mt-3 text-xs font-bold text-green-800"><CheckCircle2 size={14} className="mr-1 inline" />Paid {row.record?.payment_date ? formatDate(row.record.payment_date) : ""} · recorded in staff history</p> : <button disabled={disabled || row.amount === null || row.amount <= 0 || today < due} onClick={() => void act(`salary-${row.staff.id}`, `Confirm ${money(row.amount || 0, row.currency)} salary has been paid to ${row.staff.full_name} for ${month}? This records the payment and locks the amount.`, () => supabase.rpc("management_mark_monthly_salary_paid", { p_staff_profile_id: row.staff.id, p_month_start: start, p_expected_amount: row.amount, p_expected_currency: row.currency }))} className="mt-3 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy === `salary-${row.staff.id}` ? "Saving…" : row.amount === null ? "Set salary in Staff management" : today < due ? `Due ${formatDate(due)}` : "Mark salary paid"}</button>}
        </article>)}</div>
        <a href="/management-staff-management" className="mt-4 inline-block text-xs font-bold underline">Manage staff salary settings</a>
      </section>
      {ptPeriods.map((period, index) => <section key={period.periodStart} className="mt-5 rounded-2xl border bg-white p-4 sm:p-6">
        <h2 className="text-xl font-black">Coach PT · {index === 0 ? "First half" : "Second half"}</h2>
        <p className="mt-2 text-sm font-bold">{formatDate(period.periodStart)} – {formatDate(period.periodEnd)}</p>
        <p className="mt-1 text-xs text-[#647468]">Pay date: {formatDate(period.payDate)}{index === 1 ? " · with salary" : ""}</p>
        <div className="mt-4 rounded-xl bg-[#f3f7ef] p-4"><p className="text-xs font-bold">Automatic 50/30/20 pool</p><p className="mt-1 text-2xl font-black">{formatMoney(period.autoPool)}</p>
          {period.poolOverridden && <p className="mt-2 text-xs font-bold text-amber-900">Manually adjusted: {formatMoney(period.pool)} · automatic: {formatMoney(period.autoPool)}</p>}
          {!period.locked && <div className="mt-3 space-y-3"><button disabled={disabled || period.fullEligibleCount === 0} onClick={() => setAdjusting(adjusting === period.periodStart ? "" : period.periodStart)} className="text-xs font-bold underline disabled:opacity-40">Adjust pool</button>
            {adjusting === period.periodStart && <label className="block text-xs font-bold">Override amount (₦)<input type="number" min="0" step="0.01" value={overrides[period.periodStart] ?? String(period.pool)} disabled={disabled} onChange={(event) => setOverrides((values) => ({ ...values, [period.periodStart]: event.target.value }))} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm" /></label>}
            {(overrides[period.periodStart] !== undefined || period.poolOverridden) && <button disabled={disabled} onClick={() => setOverrides((values) => ({ ...values, [period.periodStart]: String(period.autoPool) }))} className="ml-3 text-xs font-bold underline">Use automatic amount</button>}
          </div>}
          {period.invalid && <p className="mt-2 text-xs text-red-800">Enter a valid amount of ₦0 or more.</p>}
          {period.locked && <p className="mt-2 text-xs font-bold text-green-800">{period.run?.status === "paid" ? "Paid" : "Part-paid"} · figures locked</p>}
        </div>
        {period.unassignedCount > 0 && !period.locked && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{period.unassignedCount} PT trainees have no assigned coach. Review PT assignments before finalising.</p>}
        {!period.locked && <button disabled={disabled || period.invalid || period.totalRecommended <= 0} onClick={() => void act(`save-${period.periodStart}`, null, () => supabase.rpc("management_save_pt_semimonthly_payout_run", { p_period_start: period.periodStart, p_auto_payout_pool: period.autoPool, p_payout_pool: period.pool, p_breakdown: period.rows.map(({ payment, ...row }) => row) }))} className="mt-3 rounded-xl bg-[#193b2a] px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{busy === `save-${period.periodStart}` ? "Saving…" : "Save PT payout"}</button>}
        {period.dirty && <p className="mt-2 text-xs text-amber-900">Calculation changed. Save before marking any coach paid.</p>}
        <div className="mt-4 space-y-3">{period.rows.filter((row) => matches(row.trainer_name)).map((row) => {
          const paid = !!row.payment || period.run?.status === "paid";
          const amount = cents(row.recommended_payout);
          return <article key={row.trainer_staff_profile_id} className="rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{row.trainer_name}</h3><p className="mt-1 text-xs text-[#647468]">{row.trainee_count} trainees · {row.full_pool_eligible ? "50/30/20 eligible" : row.trainee_count > 0 ? "₦10k commission only" : "No PT payout"}</p></div><strong>{money(amount)}</strong></div>
            {row.full_pool_eligible ? <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-[#f8faf6] p-3 text-xs">{[["Team", row.team_share], ["Workload", row.workload_share], ["Performance", row.performance_share]].map(([label, value]) => <div key={String(label)}><p className="text-[#647468]">{label}</p><p className="mt-1 break-words font-bold">{money(Number(value))}</p></div>)}</div> : <p className="mt-3 text-xs text-[#647468]">Fixed commission: {money(Number(row.trainee_commission || 0))} · {row.payable_membership_count || 0} payable membership cycles</p>}
            {paid ? <p className="mt-3 text-xs font-bold text-green-800">Paid {row.payment?.payment_date ? formatDate(row.payment.payment_date) : ""} · recorded in staff history</p> : amount <= 0 ? <p className="mt-3 text-xs text-[#647468]">No payment due.</p> : <button disabled={disabled || !period.run || period.dirty || period.invalid || today < period.payDate} onClick={() => void act(`pt-${period.periodStart}-${row.trainer_staff_profile_id}`, `Confirm ${money(amount)} PT payment has been paid to ${row.trainer_name} for ${formatDate(period.periodStart)} – ${formatDate(period.periodEnd)}? The period's figures will be locked.`, () => supabase.rpc("management_mark_coach_pt_paid", { p_staff_profile_id: row.trainer_staff_profile_id, p_payout_run_id: period.run?.id, p_expected_amount: amount }))} className="mt-3 rounded-xl bg-[#193b2a] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{today < period.payDate ? `Due ${formatDate(period.payDate)}` : !period.run || period.dirty ? "Save payout first" : "Mark PT paid"}</button>}
          </article>;
        })}</div>
        <div className="mt-4 flex flex-wrap justify-between gap-2 rounded-xl bg-[#193b2a] p-4 text-sm font-bold text-white"><span>Total PT payroll for this payday</span><span>{money(period.totalRecommended)}</span></div>
      </section>)}
      <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold"><a href="/management-payroll" className="underline">Payment records</a><a href="/management-personal-training" className="underline">PT assignments and evaluations</a></div>
    </>}
  </AdminWorkspaceShell>;
}
