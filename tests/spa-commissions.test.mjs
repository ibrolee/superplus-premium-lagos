import assert from "node:assert/strict";
import test from "node:test";
import { spaCommissionAmount, SPA_COMMISSION_RATE } from "../src/lib/spa-commissions.ts";

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
