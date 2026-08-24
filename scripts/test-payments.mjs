import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../docs/payments-core.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, globalThis: {} };
vm.runInNewContext(source, context);
const core = context.globalThis.CLINIC_PAYMENTS_CORE;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

// Exact agorot parsing shared with charge/allocation math.
assert.equal(core.parseAmountToAgorot("300"), 30000);
assert.equal(core.parseAmountToAgorot("300.5"), 30050);
assert.equal(core.parseAmountToAgorot("0.10"), 10);
assert.equal(core.parseAmountToAgorot("0"), null);
assert.equal(core.parseAmountToAgorot("-5"), null);
assert.equal(core.parseAmountToAgorot("12.345"), null);
assert.equal(core.parseAmountToAgorot("abc"), null);
assert.equal(core.parseAmountToAgorot(""), null);
assert.equal(core.agorotToAmountText(30050), "300.50");
assert.equal(core.agorotToAmountText(7), "0.07");

let driftTotal = 0;
for (let i = 0; i < 1000; i += 1) driftTotal += core.parseAmountToAgorot("0.10");
assert.equal(driftTotal, 10000, "1000 x 0.10 must be exactly 100.00 in agorot");

// Charge status derivation.
assert.equal(core.chargeStatus(30000, 0), "unpaid");
assert.equal(core.chargeStatus(30000, 100), "partial");
assert.equal(core.chargeStatus(30000, 30000), "paid");
assert.equal(core.chargeStatus(0, 0), "unpaid");

const charges = [
  { id: "c3", session_id: "s3", patient_id: "p1", session_date: "2026-08-20", amount: "300.00", created_at: "2026-08-20T10:00:00Z" },
  { id: "c1", session_id: "s1", patient_id: "p1", session_date: "2026-08-01", amount: "300.00", created_at: "2026-08-01T10:00:00Z" },
  { id: "c2", session_id: "s2", patient_id: "p1", session_date: "2026-08-10", amount: "300.00", created_at: "2026-08-10T10:00:00Z" }
];

// Balances are sorted oldest-first and derived from allocations only.
const noAllocationBalances = core.chargeBalances(charges, []);
assert.deepEqual(
  plain(noAllocationBalances.map((balance) => [balance.chargeId, balance.remainingAgorot, balance.status])),
  [["c1", 30000, "unpaid"], ["c2", 30000, "unpaid"], ["c3", 30000, "unpaid"]]
);
assert.equal(core.outstandingTotal(noAllocationBalances), 90000);

// The documented example: three 300 charges plus a 400 payment allocate 300/100/0 oldest-first.
const plan = core.planAllocations(noAllocationBalances, core.parseAmountToAgorot("400"));
assert.equal(plan.error, "");
assert.deepEqual(
  plain(plan.allocations.map((allocation) => [allocation.chargeId, allocation.amountAgorot])),
  [["c1", 30000], ["c2", 10000]]
);

const allocations = plan.allocations.map((allocation, index) => ({
  id: `a${index}`,
  payment_id: "pay1",
  charge_id: allocation.chargeId,
  session_id: allocation.sessionId,
  patient_id: allocation.patientId,
  amount: core.agorotToAmountText(allocation.amountAgorot)
}));

// Partial payment leaves exact balances and statuses.
const afterBalances = core.chargeBalances(charges, allocations);
assert.deepEqual(
  plain(afterBalances.map((balance) => [balance.chargeId, balance.paidAgorot, balance.remainingAgorot, balance.status])),
  [["c1", 30000, 0, "paid"], ["c2", 10000, 20000, "partial"], ["c3", 0, 30000, "unpaid"]]
);
assert.equal(core.outstandingTotal(afterBalances), 50000);

// Full payment of the rest closes every charge.
const restPlan = core.planAllocations(afterBalances.filter((balance) => balance.remainingAgorot > 0), 50000);
assert.equal(restPlan.error, "");
const closingAllocations = restPlan.allocations.map((allocation, index) => ({
  id: `b${index}`,
  payment_id: "pay2",
  charge_id: allocation.chargeId,
  session_id: allocation.sessionId,
  amount: core.agorotToAmountText(allocation.amountAgorot)
}));
const closedBalances = core.chargeBalances(charges, [...allocations, ...closingAllocations]);
assert.deepEqual(plain(closedBalances.map((balance) => balance.status)), ["paid", "paid", "paid"]);
assert.equal(core.outstandingTotal(closedBalances), 0);

// Zero, invalid, and overpayment amounts are rejected without allocations.
assert.equal(core.planAllocations(noAllocationBalances, 0).error, "invalid_amount");
assert.equal(core.planAllocations(noAllocationBalances, -100).error, "invalid_amount");
assert.equal(core.planAllocations(noAllocationBalances, 100.5).error, "invalid_amount");
assert.equal(core.planAllocations(noAllocationBalances, 90001).error, "overpayment");
assert.equal(core.planAllocations([], 100).error, "overpayment");

// Removing a payment's allocations reopens the balances.
const reopenedBalances = core.chargeBalances(charges, allocations.filter((allocation) => allocation.payment_id !== "pay1"));
assert.equal(core.outstandingTotal(reopenedBalances), 90000);
assert.deepEqual(plain(reopenedBalances.map((balance) => balance.status)), ["unpaid", "unpaid", "unpaid"]);

// Invalid stored allocation amounts are ignored instead of corrupting totals.
const dirtyBalances = core.chargeBalances(charges, [{ charge_id: "c1", amount: "oops" }]);
assert.equal(dirtyBalances[0].paidAgorot, 0);

// Same-date charges fall back to creation order for oldest-first allocation.
const sameDay = [
  { id: "d2", session_id: "s2", session_date: "2026-08-05", amount: "100.00", created_at: "2026-08-05T12:00:00Z" },
  { id: "d1", session_id: "s1", session_date: "2026-08-05", amount: "100.00", created_at: "2026-08-05T09:00:00Z" }
];
const sameDayPlan = core.planAllocations(core.chargeBalances(sameDay, []), 15000);
assert.deepEqual(
  plain(sameDayPlan.allocations.map((allocation) => [allocation.chargeId, allocation.amountAgorot])),
  [["d1", 10000], ["d2", 5000]]
);

console.log("payments-core tests passed");
