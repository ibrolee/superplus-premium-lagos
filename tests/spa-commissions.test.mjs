import assert from "node:assert/strict";
import test from "node:test";
import { spaCommissionAmount, SPA_COMMISSION_RATE, spaPayPeriods } from "../src/lib/spa-commissions.ts";

test("spa staff receive 30% of a completed service", () => {
  assert.equal(SPA_COMMISSION_RATE, 0.3);
  assert.equal(spaCommissionAmount(10000), 3000);
  assert.equal(spaCommissionAmount(7000), 2100);
  assert.equal(spaCommissionAmount(15000), 4500);
  assert.equal(spaCommissionAmount(99.99), 30);
});
test("invalid service amounts cannot produce commission", () => {
  assert.equal(spaCommissionAmount(0), 0);
  assert.equal(spaCommissionAmount(-150), 0);
  assert.equal(spaCommissionAmount(Number.NaN), 0);
});

test("spa services from days 1–15 are paid on the 16th", () => {
  const [first, second] = spaPayPeriods("2026-10");
  assert.deepEqual(first, {
    label: "1st–15th",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-15",
    payDate: "2026-10-16",
  });
  assert.deepEqual(second, {
    label: "16th–month end",
    periodStart: "2026-10-16",
    periodEnd: "2026-10-31",
    payDate: "2026-11-01",
  });
});
test("spa payroll handles leap years and December-to-January", () => {
  assert.equal(spaPayPeriods("2028-02")[1].periodEnd, "2028-02-29");
  assert.equal(spaPayPeriods("2027-02")[1].periodEnd, "2027-02-28");
  assert.equal(spaPayPeriods("2026-12")[1].payDate, "2027-01-01");
});
test("spa payout rejects invalid months", () => {
  assert.throws(() => spaPayPeriods("2026-13"), /Invalid/);
  assert.throws(() => spaPayPeriods("2026-1"), /Invalid/);
});
