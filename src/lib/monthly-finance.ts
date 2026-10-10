import {
  calculatePtPayout,
  calendarDate,
  type Assignment,
  type Evaluation,
  type PtMembership,
  type PtPayoutRun,
  type Trainer,
} from "./pt-payroll.ts";

export const FINANCE_START_MONTH = "2026-10";
export const EXPENSE_CATEGORIES = [
  { value: "internet", label: "Internet" },
  { value: "electricity", label: "Electricity" },
  { value: "petrol", label: "Petrol" },
  { value: "gas", label: "Gas" },
  { value: "membership_cards", label: "Membership cards" },
  { value: "other", label: "Other" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
export type Expense = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
  updated_at: string;
};
export type FinanceMonth = {
  month_start: string;
  month_end: string;
  revenue: number;
  revenue_count: number;
  foreign_revenue_count: number;
  revenue_baseline: string;
  revenue_complete: boolean;
  expense_total: number;
  expense_count: number;
  category_totals: Partial<Record<ExpenseCategory, number>>;
  expenses: Expense[];
};
export type PayrollStaff = {
  id: string;
  full_name: string;
  position: string | null;
  status: string;
  employment_date: string | null;
};
export type SalarySetting = {
  staff_profile_id: string;
  current_monthly_salary: number;
  currency: string;
};
export type SalaryRecord = {
  id: string;
  staff_profile_id: string;
  amount: number;
  gross_salary_amount: number | null;
  salary_advance_deduction: number;
  currency: string;
  pay_period_start: string | null;
  pay_period_end: string | null;
  payment_date: string | null;
  status: string;
  payroll_kind: string | null;
  pt_payout_run_id: string | null;
};
export type Advance = {
  staff_profile_id: string;
  salary_month: string;
  amount: number;
  currency: string;
  status: string;
};
export type ContractPeriod = {
  period_start: string;
  rows: {
    commission: number;
    source: string | null;
    assigned_to_ifeanyi: boolean | null;
    review_status: string;
  }[];
  run: { total: number; status: string } | null;
};
export type PayrollData = {
  staff: PayrollStaff[];
  settings: SalarySetting[];
  records: SalaryRecord[];
  advances: Advance[];
  trainers: Trainer[];
  memberships: PtMembership[];
  assignments: Assignment[];
  evaluations: Evaluation[];
  runs: PtPayoutRun[];
  contract: { staff_id: string; periods: ContractPeriod[] };
};
export type CostRow = {
  id: string;
  name: string;
  amount: number;
  paid: number;
  estimated: boolean;
  missing: boolean;
};
export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
const ngn = (currency: string | null) => (currency || "NGN").toUpperCase() === "NGN";
const ADMIN_PLACEHOLDER = "48031602-21f1-4210-945e-2fefd83e6f52";

export function monthlyPayrollCosts(data: PayrollData, month: string, today: string) {
  const start = month + "-01";
  const date = new Date(start + "T12:00:00Z");
  const end = calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  const monthlyRecords = data.records.filter(
    (r) =>
      r.status !== "cancelled" &&
      (!r.payroll_kind || r.payroll_kind === "monthly_salary") &&
      r.pay_period_start === start &&
      r.pay_period_end === end,
  );
  const issues: string[] = [];
  const eligible = data.staff.filter(
    (staff) =>
      staff.id !== ADMIN_PLACEHOLDER &&
      staff.id !== data.contract.staff_id &&
      !/ifeanyi/i.test(staff.full_name) &&
      (monthlyRecords.some((r) => r.staff_profile_id === staff.id) ||
        (staff.status === "approved" && (!staff.employment_date || staff.employment_date <= end))),
  );
  const salaries: CostRow[] = eligible.map((staff) => {
    const records = monthlyRecords.filter((r) => r.staff_profile_id === staff.id);
    if (records.length > 1) issues.push(`Duplicate salary records for ${staff.full_name}.`);
    const record = records[0];
    const setting = data.settings.find((s) => s.staff_profile_id === staff.id);
    const missing = !record && !setting;
    if (missing) issues.push(`Set a salary for ${staff.full_name}.`);
    const currency = record?.currency || setting?.currency || "NGN";
    if (!ngn(currency))
      issues.push(
        `${staff.full_name}'s salary is in ${currency}; it cannot be added to a naira report.`,
      );
    // Records store the net balance after an advance. Cost is always the full gross salary.
    const gross = record
      ? Number(
          record.gross_salary_amount ??
            Number(record.amount) + Number(record.salary_advance_deduction || 0),
        )
      : Number(setting?.current_monthly_salary || 0);
    const advances = data.advances
      .filter(
        (a) =>
          a.staff_profile_id === staff.id &&
          a.salary_month === start &&
          a.status === "paid" &&
          ngn(a.currency),
      )
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const paid =
      record?.status === "paid"
        ? Number(record.amount) + Number(record.salary_advance_deduction || 0)
        : advances;
    return {
      id: staff.id,
      name: staff.full_name,
      amount: ngn(currency) ? roundMoney(gross) : 0,
      paid: ngn(currency) ? roundMoney(Math.min(gross, paid)) : 0,
      estimated: !record,
      missing,
    };
  });
  const assignmentMap = new Map(data.assignments.map((a) => [a.membership_id, a]));
  const trainers = data.trainers.filter(
    (t) =>
      t.staff_profile_id !== ADMIN_PLACEHOLDER &&
      t.staff_profile_id !== data.contract.staff_id &&
      !/ifeanyi/i.test(t.display_name),
  );
  const coachRows: CostRow[] = [];
  for (const periodStart of [start, month + "-16"]) {
    const runs = data.runs.filter((r) => r.period_start === periodStart);
    if (runs.length > 1) issues.push(`Duplicate coach payout runs for ${periodStart}.`);
    const run = runs[0] || null;
    const calculation = calculatePtPayout({
      trainers,
      memberships: data.memberships,
      evaluations: data.evaluations,
      assignmentMap,
      payoutPeriodStart: periodStart,
      payoutPool: null,
      payoutRuns: data.runs,
      selectedPayoutRun: run,
      today,
    });
    if (calculation.unassignedCount)
      issues.push(
        `${calculation.unassignedCount} PT clients need a coach for the period beginning ${periodStart}.`,
      );
    const locked = run?.status === "paid" || run?.financial_locked === true;
    for (const row of calculation.rows) {
      const amount = roundMoney(Number(row.recommended_payout || 0));
      const payments = data.records.filter(
        (r) =>
          r.status === "paid" &&
          r.pt_payout_run_id === run?.id &&
          !!run &&
          r.staff_profile_id === row.trainer_staff_profile_id,
      );
      if (payments.length > 1) issues.push(`Duplicate PT payments for ${row.trainer_name}.`);
      if (payments.some((r) => !ngn(r.currency)))
        issues.push(`A PT payment for ${row.trainer_name} is not in naira.`);
      coachRows.push({
        id: periodStart + "-" + row.trainer_staff_profile_id,
        name: `${row.trainer_name} · ${periodStart.slice(-2) === "01" ? "1st half" : "2nd half"} PT`,
        amount,
        paid: run?.status === "paid" || payments.length ? amount : 0,
        estimated: amount > 0 && !locked,
        missing: false,
      });
    }
  }
  const contractRows: CostRow[] = data.contract.periods
    .filter((p) => p.period_start === start)
    .map((period) => {
      const paid = period.run?.status === "paid";
      const needsReview =
        !paid &&
        period.rows.some(
          (r) =>
            (r.source === "coach" || r.assigned_to_ifeanyi) &&
            !["Ready", "Previously commissioned"].includes(r.review_status),
        );
      if (needsReview) issues.push("Part-time coach commissions need review in Salary payments.");
      const amount = roundMoney(
        paid
          ? Number(period.run?.total || 0)
          : period.rows.reduce((sum, r) => sum + Number(r.commission || 0), 0),
      );
      return {
        id: "contract-" + start,
        name: "Part-time coach commissions",
        amount,
        paid: paid ? amount : 0,
        estimated: amount > 0 && !paid,
        missing: needsReview,
      };
    });
  const salary = roundMoney(salaries.reduce((sum, r) => sum + r.amount, 0));
  const pt = roundMoney([...coachRows, ...contractRows].reduce((sum, r) => sum + r.amount, 0));
  const paid = roundMoney(
    [...salaries, ...coachRows, ...contractRows].reduce((sum, r) => sum + r.paid, 0),
  );
  return {
    salary,
    pt,
    total: roundMoney(salary + pt),
    paid,
    outstanding: roundMoney(Math.max(0, salary + pt - paid)),
    salaries,
    coachRows: [...coachRows, ...contractRows],
    issues,
    estimated:
      month >= today.slice(0, 7) ||
      [...salaries, ...coachRows, ...contractRows].some((r) => r.estimated),
  };
}

export function operatingResult(revenue: number, expenses: number, payroll: number) {
  const profit = roundMoney(revenue - expenses - payroll);
  return { profit, margin: revenue > 0 ? (profit / revenue) * 100 : null };
}
