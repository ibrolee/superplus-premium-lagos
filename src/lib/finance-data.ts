import { supabase } from "./supabase";
import type { Assignment, Evaluation, PtMembership, PtPayoutRun, Trainer } from "./pt-payroll";
import type {
  Advance,
  FinanceMonth,
  PayrollData,
  PayrollStaff,
  SalaryRecord,
  SalarySetting,
} from "./monthly-finance";

async function readAll<T>(
  table: string,
  columns: string,
  key = "id",
  ptOnly = false,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase
      .from(table)
      .select(columns)
      .order(key)
      .range(offset, offset + 499);
    if (ptOnly) query = query.ilike("plan_name", "Personal Training%");
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

export async function loadFinanceMonth(
  month: string,
): Promise<{ finance: FinanceMonth; payroll: PayrollData }> {
  const [
    finance,
    contract,
    staff,
    settings,
    records,
    advances,
    trainers,
    memberships,
    assignments,
    evaluations,
    runs,
  ] = await Promise.all([
    supabase.rpc("admin_get_finance_month", { p_month_start: month + "-01" }),
    supabase.rpc("management_get_ifeanyi_payroll", { p_month_start: month + "-01" }),
    readAll<PayrollStaff>("staff_profiles", "id,full_name,position,status,employment_date"),
    readAll<SalarySetting>(
      "staff_salary_settings",
      "staff_profile_id,current_monthly_salary,currency",
      "staff_profile_id",
    ),
    readAll<SalaryRecord>(
      "staff_salary_records",
      "id,staff_profile_id,amount,currency,pay_period_start,pay_period_end,payment_date,status,payroll_kind,pt_payout_run_id,gross_salary_amount,salary_advance_deduction",
    ),
    readAll<Advance>(
      "staff_salary_advances",
      "id,staff_profile_id,salary_month,amount,currency,status",
    ),
    readAll<Omit<Trainer, "staff_title">>(
      "pt_trainers",
      "staff_profile_id,display_name,active,sort_order",
      "staff_profile_id",
    ),
    readAll<PtMembership>(
      "memberships",
      "id,member_id,plan_name,start_date,end_date,status,payment_status,created_at",
      "id",
      true,
    ),
    readAll<Assignment>(
      "pt_assignments",
      "membership_id,member_id,trainer_staff_profile_id,updated_at",
      "membership_id",
    ),
    readAll<Evaluation>(
      "pt_evaluations",
      "membership_id,member_id,trainer_staff_profile_id,overall_rating,submitted_at",
      "membership_id",
    ),
    readAll<PtPayoutRun>(
      "pt_semimonthly_payout_runs",
      "id,period_start,period_end,pay_date,auto_payout_pool,payout_pool,breakdown,status,financial_locked,paid_at,created_by,updated_at",
    ),
  ]);
  if (finance.error) throw finance.error;
  if (contract.error) throw contract.error;
  if (!finance.data || !contract.data)
    throw Error("Monthly finance data is unavailable. Refresh and try again.");
  return {
    finance: finance.data as FinanceMonth,
    payroll: {
      staff,
      settings,
      records,
      advances,
      memberships,
      assignments,
      evaluations,
      runs,
      contract: contract.data,
      trainers: trainers.map((t) => ({
        ...t,
        staff_title: staff.find((s) => s.id === t.staff_profile_id)?.position || null,
      })),
    },
  };
}
