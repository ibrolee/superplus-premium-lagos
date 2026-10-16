import assert from "node:assert/strict";
import test from "node:test";
import { memberPlanSummary } from "../src/lib/admin-member-status.ts";
const plan = (values = {}) => ({
  id: "p",
  member_id: "m",
  plan_name: "Monthly",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
  status: "active",
  payment_status: "paid",
  ...values,
});
test("unpaid and paused plans never show as active", () => {
  assert.equal(
    memberPlanSummary([plan({ payment_status: "pending" })], "2026-10-16").status,
    "other",
  );
  assert.equal(memberPlanSummary([plan({ status: "paused" })], "2026-10-16").status, "paused");
});
test("start and expiry dates are inclusive in Lagos calendar dates", () => {
  assert.equal(memberPlanSummary([plan()], "2026-10-01").status, "active");
  assert.equal(memberPlanSummary([plan()], "2026-10-31").status, "expiring");
  assert.equal(memberPlanSummary([plan()], "2026-11-01").status, "expired");
});
test("overlapping plans show the active count and the later expiry", () => {
  const summary = memberPlanSummary(
    [plan({ end_date: "2026-10-18" }), plan({ id: "pt", plan_name: "Personal Training Only" })],
    "2026-10-16",
  );
  assert.equal(summary.plan, "2 active plans");
  assert.equal(summary.expiry, "2026-10-31");
  assert.equal(summary.status, "active");
});
test("future paid membership does not activate access early, and empty history has no plan", () => {
  assert.equal(
    memberPlanSummary([plan({ start_date: "2026-10-20" })], "2026-10-16").status,
    "upcoming",
  );
  assert.equal(memberPlanSummary([], "2026-10-16").status, "none");
});
