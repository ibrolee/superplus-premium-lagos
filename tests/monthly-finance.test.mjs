import assert from "node:assert/strict";
import test from "node:test";
import {
  monthlyPayrollCosts,
  operatingResult,
  FINANCE_START_MONTH,
} from "../src/lib/monthly-finance.ts";
const staff = (id, name = id, status = "approved") => ({
  id,
  full_name: name,
  status,
  position: null,
  employment_date: "2026-09-01",
});
const fixture = () => ({
  staff: [staff("james")],
  settings: [{ staff_profile_id: "james", current_monthly_salary: 100000, currency: "NGN" }],
  records: [],
  advances: [],
  trainers: [],
  memberships: [],
  assignments: [],
  evaluations: [],
  runs: [],
  contract: { staff_id: "ifeanyi", periods: [] },
});
const record = (extra = {}) => ({
  id: "salary-1",
  staff_profile_id: "james",
  amount: 60000,
  gross_salary_amount: 100000,
  salary_advance_deduction: 40000,
  currency: "NGN",
  pay_period_start: "2026-10-01",
  pay_period_end: "2026-10-31",
  payment_date: "2026-11-01",
  status: "paid",
  payroll_kind: "monthly_salary",
  pt_payout_run_id: null,
  ...extra,
});
test("reports start in October; loss and zero revenue have meaningful results", () => {
  assert.equal(FINANCE_START_MONTH, "2026-10");
  assert.deepEqual(operatingResult(200000, 25000, 100000), { profit: 75000, margin: 37.5 });
  assert.deepEqual(operatingResult(0, 25000, 100000), { profit: -125000, margin: null });
});
test("October gross salary belongs to October even when paid in November; advances are not deducted twice", () => {
  const data = fixture();
  data.records.push(record());
  data.advances.push({
    staff_profile_id: "james",
    salary_month: "2026-10-01",
    amount: 40000,
    currency: "NGN",
    status: "paid",
  });
  const october = monthlyPayrollCosts(data, "2026-10", "2026-11-02");
  assert.equal(october.salary, 100000);
  assert.equal(october.paid, 100000);
  assert.equal(october.outstanding, 0);
  assert.equal(october.estimated, false);
  const november = monthlyPayrollCosts(data, "2026-11", "2026-11-02");
  assert.equal(november.salary, 100000);
  assert.equal(november.paid, 0);
  assert.equal(november.estimated, true);
});
test("fallback gross reconstructs the advance deduction; pending advances do not count as money paid", () => {
  const data = fixture();
  data.records.push(record({ gross_salary_amount: null, status: "pending", payment_date: null }));
  data.advances.push({
    staff_profile_id: "james",
    salary_month: "2026-10-01",
    amount: 40000,
    currency: "NGN",
    status: "approved",
  });
  const costs = monthlyPayrollCosts(data, "2026-10", "2026-11-02");
  assert.equal(costs.salary, 100000);
  assert.equal(costs.paid, 0);
  assert.equal(costs.outstanding, 100000);
});
test("saved salary overrides current settings and preserves departed staff; future hires and the admin placeholder are excluded", () => {
  const data = fixture();
  data.staff[0].status = "inactive";
  data.settings[0].current_monthly_salary = 200000;
  data.records.push(record());
  data.staff.push(
    { ...staff("future"), employment_date: "2026-11-01" },
    staff("48031602-21f1-4210-945e-2fefd83e6f52", "Super Plus Fitness Admin"),
  );
  assert.equal(monthlyPayrollCosts(data, "2026-10", "2026-11-02").salary, 100000);
});
test("paid PT snapshots and contract payroll are included once without recounting their payment records", () => {
  const data = fixture();
  data.records.push(
    record(),
    record({
      id: "pt-payment",
      payroll_kind: "pt_commission",
      amount: 10000,
      gross_salary_amount: null,
      salary_advance_deduction: 0,
      pt_payout_run_id: "pt-1",
      pay_period_end: "2026-10-15",
    }),
  );
  data.runs.push({
    id: "pt-1",
    period_start: "2026-10-01",
    period_end: "2026-10-15",
    pay_date: "2026-10-16",
    status: "paid",
    financial_locked: true,
    auto_payout_pool: 10000,
    payout_pool: 10000,
    breakdown: [
      { trainer_staff_profile_id: "james", trainer_name: "James", recommended_payout: 10000 },
    ],
  });
  data.contract.periods.push({
    period_start: "2026-10-01",
    rows: [{ commission: 15000, source: "coach", review_status: "Ready" }],
    run: { total: 15000, status: "paid" },
  });
  const costs = monthlyPayrollCosts(data, "2026-10", "2026-11-02");
  assert.equal(costs.pt, 25000);
  assert.equal(costs.total, 125000);
  assert.equal(costs.paid, 125000);
});
test("missing settings, conflicting salaries and non-naira records require review", () => {
  const data = fixture();
  data.settings = [];
  assert.match(monthlyPayrollCosts(data, "2026-10", "2026-11-02").issues[0], /Set a salary/);
  data.records.push(record(), record({ id: "duplicate", currency: "USD" }));
  assert.match(monthlyPayrollCosts(data, "2026-10", "2026-11-02").issues[0], /Duplicate/);
  data.records = [record({ currency: "USD" })];
  const costs = monthlyPayrollCosts(data, "2026-10", "2026-11-02");
  assert.equal(costs.salary, 0);
  assert.match(costs.issues[0], /USD/);
});
