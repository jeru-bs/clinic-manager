import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../docs/business-core.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const core = context.globalThis.CLINIC_BUSINESS_CORE;

// The vm realm has its own Array/Object prototypes; deepEqual needs plain local values.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

// Month-to-period and year mapping, including the exact Hebrew folder names.
assert.equal(core.BUSINESS_ROOT_FOLDER_NAME, "ניהול עסק");
assert.deepEqual(
  plain(core.PERIODS.map((period) => period.label)),
  ["ינואר - פברואר", "מרץ - אפריל", "מאי - יוני", "יולי - אוגוסט", "ספטמבר - אוקטובר", "נובמבר - דצמבר"]
);
assert.equal(core.periodForMonth(1).key, "01-02");
assert.equal(core.periodForMonth(2).key, "01-02");
assert.equal(core.periodForMonth(3).key, "03-04");
assert.equal(core.periodForMonth(8).label, "יולי - אוגוסט");
assert.equal(core.periodForMonth(12).key, "11-12");
assert.equal(core.periodForMonth(0), null);
assert.equal(core.periodForMonth(13), null);
assert.deepEqual(plain(core.periodForDate("2026-08-24")), { year: "2026", key: "07-08", label: "יולי - אוגוסט" });
assert.deepEqual(plain(core.periodForDate("2025-12-31")), { year: "2025", key: "11-12", label: "נובמבר - דצמבר" });
assert.equal(core.periodForDate("not-a-date"), null);
assert.equal(core.periodForDate(""), null);

// ISO date validation, including real calendar dates.
assert.equal(core.isValidIsoDate("2024-02-29"), true, "leap-year date must be accepted");
assert.equal(core.isValidIsoDate("2026-02-29"), false, "non-leap 29.2 must be rejected");
assert.equal(core.isValidIsoDate("2026-13-01"), false);
assert.equal(core.isValidIsoDate("2026-04-31"), false);
assert.equal(core.isValidIsoDate("2026-1-05"), false, "only zero-padded ISO dates are stored");

// Amount validation in exact integer agorot.
assert.equal(core.parseAmountToAgorot("150"), 15000);
assert.equal(core.parseAmountToAgorot("150.5"), 15050);
assert.equal(core.parseAmountToAgorot("150.55"), 15055);
assert.equal(core.parseAmountToAgorot("0.01"), 1);
assert.equal(core.parseAmountToAgorot("150.555"), null, "more than two decimals must be rejected");
assert.equal(core.parseAmountToAgorot("0"), null, "zero amount must be rejected");
assert.equal(core.parseAmountToAgorot("0.00"), null);
assert.equal(core.parseAmountToAgorot("-5"), null, "negative amount must be rejected");
assert.equal(core.parseAmountToAgorot("abc"), null);
assert.equal(core.parseAmountToAgorot(""), null);
assert.equal(core.parseAmountToAgorot("1,000"), null);
assert.equal(core.agorotToAmountText(15050), "150.50");
assert.equal(core.agorotToAmountText(1), "0.01");
assert.equal(core.agorotToAmountText(-2500), "-25.00");

// Exact totals: 1000 records of 0.10 must sum with no floating-point drift.
const drift = Array.from({ length: 1000 }, (_, index) => ({
  id: `r-${index}`,
  document_date: "2026-07-01",
  record_type: "income",
  amount: "0.10"
}));
assert.equal(core.summarizeRecords(drift).incomeAgorot, 10000, "1000 x 0.10 must equal exactly 100.00");

const sample = [
  { id: "a", document_date: "2026-07-10", record_type: "income", amount: "100.10" },
  { id: "b", document_date: "2026-08-24", record_type: "income", amount: "200.20" },
  { id: "c", document_date: "2026-08-01", record_type: "expense", amount: "50.05" },
  { id: "d", document_date: "2026-09-01", record_type: "expense", amount: "25.00" },
  { id: "e", document_date: "bad-date", record_type: "income", amount: "999" }
];
const totals = core.summarizeRecords(sample);
assert.equal(totals.incomeAgorot, 30030 + 99900);
assert.equal(totals.expenseAgorot, 7505);
assert.equal(totals.balanceAgorot, 30030 + 99900 - 7505);

// Period filtering follows the document date's year and two-month period.
const julyAugust = core.recordsInPeriod(sample, "2026", "07-08");
assert.deepEqual(plain(julyAugust.map((record) => record.id)), ["a", "b", "c"]);
assert.deepEqual(plain(core.recordsInPeriod(sample, "2026", "09-10").map((record) => record.id)), ["d"]);
assert.deepEqual(plain(core.recordsInPeriod(sample, "2025", "07-08")), []);

// Custom range filtering is inclusive on both ends and skips invalid dates.
const range = core.recordsInRange(sample, "2026-08-01", "2026-08-24");
assert.deepEqual(plain(range.map((record) => record.id)), ["b", "c"], "range must include both boundary dates");
assert.deepEqual(plain(core.recordsInRange(sample, "2026-08-02", "2026-08-23")), []);
const rangeTotals = core.summarizeRecords(range);
assert.equal(rangeTotals.balanceAgorot, 20020 - 5005);

// Form-level validation for the upload flow.
assert.equal(core.validateRecordInput({ document_date: "2026-08-24", record_type: "income", amount: "150.5" }).error, "");
assert.equal(core.validateRecordInput({ document_date: "2026-08-24", record_type: "income", amount: "150.5" }).amount, "150.50");
assert.match(core.validateRecordInput({ document_date: "", record_type: "income", amount: "10" }).error, /תאריך/);
assert.match(core.validateRecordInput({ document_date: "2026-08-24", record_type: "", amount: "10" }).error, /סוג/);
assert.match(core.validateRecordInput({ document_date: "2026-08-24", record_type: "other", amount: "10" }).error, /סוג/);
assert.match(core.validateRecordInput({ document_date: "2026-08-24", record_type: "expense", amount: "10.999" }).error, /סכום/);

console.log("Business tests: period mapping, exact agorot totals, inclusive ranges, amount/date validation: ok");
