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


// ---- No-show / late-cancellation fees ---------------------------------------------------
assert.deepEqual(plain(core.NO_SHOW_POLICIES), ["none", "full", "half", "fixed"]);
assert.deepEqual(plain(core.NO_SHOW_STATUSES), ["no_show", "cancelled_late"]);
assert.equal(core.normalizeNoShowPolicy(" half "), "half");
assert.equal(core.normalizeNoShowPolicy("bogus"), "", "unknown policies fall back to inherit");
assert.equal(core.normalizeNoShowPolicy(undefined), "");

const fullPatient = { fixed_price: "300", no_show_policy: "full", no_show_fee: "" };
const halfPatient = { fixed_price: "175", no_show_policy: "half", no_show_fee: "" };
const fixedPatient = { fixed_price: "300", no_show_policy: "fixed", no_show_fee: "120" };
const nonePatient = { fixed_price: "300", no_show_policy: "none", no_show_fee: "" };
const inheritPatient = { fixed_price: "300", no_show_policy: "", no_show_fee: "" };
const noShow = { status: "no_show" };
const late = { status: "cancelled_late" };

assert.equal(core.noShowChargeAmount(noShow, fullPatient, {}), 30000, "full policy charges the session price");
assert.equal(core.noShowChargeAmount(late, fullPatient, {}), 30000, "late cancellation is charged like a no-show");
assert.equal(core.noShowChargeAmount(noShow, halfPatient, {}), 8800, "half of 175 rounds to whole shekels (88)");
assert.equal(core.noShowChargeAmount(noShow, { fixed_price: "0.50", no_show_policy: "half" }, {}), null, "a half that rounds to zero charges nothing");
assert.equal(core.noShowChargeAmount(noShow, fixedPatient, {}), 12000, "fixed policy charges the patient fee");
assert.equal(core.noShowChargeAmount(noShow, { no_show_policy: "fixed", no_show_fee: "abc" }, {}), null, "an invalid fixed fee charges nothing");
assert.equal(core.noShowChargeAmount(noShow, nonePatient, { noShowPolicyDefault: "full" }), null, "explicit none overrides the clinic default");
assert.equal(core.noShowChargeAmount(noShow, inheritPatient, {}), null, "no policy anywhere means no charge");
assert.equal(core.noShowChargeAmount(noShow, inheritPatient, { noShowPolicyDefault: "full" }), 30000, "an empty patient policy inherits the clinic default");
assert.equal(core.noShowChargeAmount(noShow, inheritPatient, { noShowPolicyDefault: "fixed", noShowFeeDefault: "80" }), 8000, "the clinic default fee applies to inheriting patients");
assert.equal(core.noShowChargeAmount(noShow, fullPatient, { noShowPolicyDefault: "none" }), 30000, "a patient policy overrides the clinic default");
assert.equal(core.noShowChargeAmount(noShow, { no_show_policy: "full" }, {}), null, "full policy without a fixed price charges nothing");
assert.equal(core.noShowChargeAmount({ status: "cancelled" }, fullPatient, {}), null, "a plain cancellation is never charged");
assert.equal(core.noShowChargeAmount({ status: "completed" }, fullPatient, {}), null);
assert.equal(core.noShowChargeAmount({ status: "scheduled" }, fullPatient, {}), null);
assert.equal(core.noShowChargeAmount(null, fullPatient, {}), null);
assert.deepEqual(plain(core.resolveNoShowPolicy(inheritPatient, { noShowPolicyDefault: "half" })), { policy: "half", fee: "", source: "settings" });
assert.deepEqual(plain(core.resolveNoShowPolicy(fixedPatient, {})), { policy: "fixed", fee: "120", source: "patient" });
assert.deepEqual(plain(core.resolveNoShowPolicy({}, {})), { policy: "none", fee: "", source: "default" });
console.log("payments-core no-show fee tests passed");

console.log("payments-core tests passed");
