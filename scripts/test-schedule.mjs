import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// schedule-core destructures CLINIC_FORMAT_CORE at load time, so the cores load in dependency order.
const context = { module: { exports: {} }, globalThis: {} };
for (const file of ["business-core.js", "format-core.js", "schedule-core.js"]) {
  vm.runInNewContext(readFileSync(new URL(`../docs/${file}`, import.meta.url), "utf8"), context);
}
const api = context.globalThis.CLINIC_SCHEDULE_CORE;

// Every export must be exercised: the proxy records which keys the assertions below touch.
const covered = new Set();
const core = new Proxy(api, {
  get(target, key) {
    covered.add(key);
    return target[key];
  }
});

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

// Core values come from another vm realm, so structural comparison goes through a JSON round-trip.
function deepEqual(actual, expected, message) {
  assert.deepEqual(plain(actual), expected, message);
}

// Israel holidays: only Hanukkah and minor fasts may keep a treatment in place.
assert.equal(core.israelHolidayConflictKind({ conflictKind: "optional" }), "optional");
assert.equal(core.israelHolidayConflictKind({ conflictKind: "required" }), "required");
assert.equal(core.israelHolidayConflictKind({ title: "Chanukah: 1 Candle" }), "optional");
assert.equal(core.israelHolidayConflictKind({ hebrew: "חנוכה: נר ראשון" }), "optional");
assert.equal(core.israelHolidayConflictKind({ title: "Tish'a B'Av", subcat: "fast" }), "required");
assert.equal(core.israelHolidayConflictKind({ hebrew: "תשעה באב", subcat: "fast" }), "required");
assert.equal(core.israelHolidayConflictKind({ title: "Tzom Gedaliah", subcat: "fast" }), "optional");
assert.equal(core.israelHolidayConflictKind({ title: "Rosh Hashana" }), "required");
assert.equal(core.israelHolidayConflictKind(null), "required");

const normalized = core.normalizeIsraelHoliday({
  date: "2026-09-12",
  title: "Rosh Hashana",
  hebrew: "ראש השנה",
  memo: "memo",
  link: "https://www.hebcal.com/holidays/rosh-hashana",
  subcat: "major",
  yomtov: true
});
deepEqual(plain(normalized), {
  date: "2026-09-12",
  title: "ראש השנה",
  memo: "memo",
  link: "https://www.hebcal.com/holidays/rosh-hashana",
  subcat: "major",
  yomtov: true,
  conflictKind: "required"
});
const sparse = core.normalizeIsraelHoliday({ title: "Chanukah", link: "https://evil.example/", yomtov: "true" });
assert.equal(sparse.title, "Chanukah");
assert.equal(sparse.link, "https://www.hebcal.com/", "foreign links are replaced by the Hebcal home page");
assert.equal(sparse.yomtov, false);
assert.equal(sparse.conflictKind, "optional");
assert.equal(core.normalizeIsraelHoliday(null).title, "מועד ישראל");
assert.equal(core.normalizeIsraelHoliday({ link: "https://hebcal.com/x" }).link, "https://hebcal.com/x");

assert.equal(core.israelHolidayConflictKindForDate([{ conflictKind: "optional" }, { conflictKind: "required" }]), "required");
assert.equal(core.israelHolidayConflictKindForDate([{ conflictKind: "optional" }]), "optional");
assert.equal(core.israelHolidayConflictKindForDate([]), "optional");

// Projections, dashboard aggregation and ordering.
assert.equal(core.sessionIsProjected({ is_recurring: true, _rowNumber: 5 }), true);
assert.equal(core.sessionIsProjected({ _rowNumber: 5 }), false);
assert.equal(core.sessionIsProjected({}), true);

const debts = core.dashboardDebtRows([
  { patientId: "p1", remainingAgorot: 5000, sessionDate: "2026-03-01" },
  { patientId: "p1", remainingAgorot: 0, sessionDate: "2026-01-01" },
  { patientId: "p2", remainingAgorot: 20000, sessionDate: "2026-03-01" },
  { patientId: "p3", remainingAgorot: 100, sessionDate: "2026-02-01" },
  { patientId: "p1", remainingAgorot: 1000, sessionDate: "2026-02-15" },
  { patientId: "p4", remainingAgorot: 300, sessionDate: "" }
]);
deepEqual(plain(debts), [
  { patientId: "p3", remainingAgorot: 100, oldestDate: "2026-02-01", count: 1 },
  { patientId: "p1", remainingAgorot: 6000, oldestDate: "2026-02-15", count: 2 },
  { patientId: "p2", remainingAgorot: 20000, oldestDate: "2026-03-01", count: 1 },
  { patientId: "p4", remainingAgorot: 300, oldestDate: "", count: 1 }
]);
deepEqual(core.dashboardDebtRows([]), []);

const taskRows = core.dashboardTaskRows(
  [
    { id: "undated", status: "open" },
    { id: "future", status: "open", due_date: "2026-09-10" },
    { id: "done", status: "done", due_date: "2026-01-01" },
    { id: "overdue", status: "open", due_date: "2026-08-01" },
    { id: "reminder", status: "waiting", reminder_at: "2026-09-02" }
  ],
  "2026-09-02"
);
deepEqual(taskRows.map((task) => task.id), ["overdue", "reminder", "future", "undated"]);

assert.equal(core.sessionChronologyKey({ session_date: "2026-09-02", start_time: "10:00", created_at: "c" }), "2026-09-02 10:00 c");
assert.equal(core.sessionChronologyKey(null), "  ");

const today = "2026-09-02";
assert.equal(core.taskDueMatches({ due_date: "" }, "", today), true);
assert.equal(core.taskDueMatches({ status: "open", due_date: "2026-09-01" }, "overdue", today), true);
assert.equal(core.taskDueMatches({ status: "done", due_date: "2026-09-01" }, "overdue", today), false);
assert.equal(core.taskDueMatches({ status: "open", due_date: "2026-09-02" }, "overdue", today), false);
assert.equal(core.taskDueMatches({ due_date: "2026-09-02" }, "today", today), true);
assert.equal(core.taskDueMatches({ due_date: "2026-09-03" }, "today", today), false);
assert.equal(core.taskDueMatches({ due_date: "2026-09-08" }, "week", today), true);
assert.equal(core.taskDueMatches({ due_date: "2026-09-09" }, "week", today), false);
assert.equal(core.taskDueMatches({ due_date: "2026-09-01" }, "week", today), false);
assert.equal(core.taskDueMatches({ due_date: "" }, "week", today), false);
assert.equal(core.taskDueMatches({ due_date: "" }, "no_date", today), true);
assert.equal(core.taskDueMatches({ due_date: "2026-09-02" }, "no_date", today), false);
assert.equal(core.taskDueMatches({ due_date: "2026-09-02" }, "unknown", today), true);
assert.equal(typeof core.taskDueMatches({ due_date: "2026-09-02" }, "today"), "boolean", "today defaults to the current date");

// Session status.
assert.equal(core.RECURRING_PLACEHOLDER_SUMMARY, "מפגש קבוע לפי הגדרת המטופל.");
deepEqual(Object.keys(core.SESSION_STATUS_LABELS), ["scheduled", "completed", "cancelled", "cancelled_late", "no_show"]);
assert.equal(core.SESSION_STATUS_LABELS.cancelled_late, "ביטול מאוחר");
assert.equal(core.isCancelledStatus("cancelled"), true);
assert.equal(core.isCancelledStatus("cancelled_late"), true);
assert.equal(core.isCancelledStatus("no_show"), false);
assert.equal(core.SESSION_STATUS_TONES.completed, "success");
assert.equal(core.SESSION_STATUS_TONES.cancelled_late, "danger");
assert.equal(core.SESSION_STATUS_TONES.scheduled, "");
assert.equal(core.sessionHasDocumentation({ summary: core.RECURRING_PLACEHOLDER_SUMMARY }), false);
assert.equal(core.sessionHasDocumentation({ summary: "   " }), false);
assert.equal(core.sessionHasDocumentation({ summary: "סיכום" }), true);
assert.equal(core.sessionHasDocumentation(null), false);
assert.equal(core.sessionEffectiveStatus({ status: "no_show" }), "no_show");
assert.equal(core.sessionEffectiveStatus({ status: "bogus", summary: "סיכום" }), "completed");
assert.equal(core.sessionEffectiveStatus({ summary: "" }), "scheduled");
assert.equal(core.sessionStatusLabel({ status: "completed" }), "התקיים");
assert.equal(core.sessionStatusLabel({}), "מתוכנן");
assert.equal(core.sessionIsCancelled({ status: "cancelled_late" }), true);
assert.equal(core.sessionIsCancelled({ status: "scheduled" }), false);
assert.equal(core.sessionOccupiesSlot({ status: "no_show" }), true);
assert.equal(core.sessionOccupiesSlot({ status: "cancelled" }), false);

// Fixed days and exceptions.
assert.equal(core.fixedDayIndex("יום שני"), 1);
assert.equal(core.fixedDayIndex("ראשון"), 0);
assert.equal(core.fixedDayIndex("שבת"), 6);
assert.equal(core.fixedDayIndex(""), -1);
assert.equal(core.fixedDayIndex(), -1);
assert.equal(core.exceptionApplies({ start_date: "" }, "p1", "2026-09-02"), false);
assert.equal(core.exceptionApplies({ start_date: "2026-09-02", patient_id: "p2" }, "p1", "2026-09-02"), false);
assert.equal(core.exceptionApplies({ start_date: "2026-09-02", patient_id: "p1" }, "p1", "2026-09-02"), true);
assert.equal(core.exceptionApplies({ start_date: "2026-09-01", end_date: "2026-09-05" }, "p1", "2026-09-03"), true);
assert.equal(core.exceptionApplies({ start_date: "2026-09-01" }, "p1", "2026-09-02"), false, "end date defaults to the start date");

// Recurring series.
assert.equal(core.MAX_RECURRING_OCCURRENCES, 400);
deepEqual(core.normalizeRecurringBounds({}), { fixedDay: "", fixedTime: "", startDate: "", endDate: "" });
assert.throws(() => core.normalizeRecurringBounds({ fixed_start_date: "2026-01-01" }), /טווח תאריכים/);
assert.throws(() => core.normalizeRecurringBounds({ fixed_day: "שני" }), /גם יום קבוע וגם שעה קבועה/);
assert.throws(() => core.normalizeRecurringBounds({ fixed_day: "שני", fixed_time: "10:00" }), /תאריך התחלה ותאריך סיום/);
assert.throws(
  () => core.normalizeRecurringBounds({ fixed_day: "שני", fixed_time: "10:00", fixed_start_date: "2026-02-01", fixed_end_date: "2026-01-01" }),
  /לא יכול להיות לפני/
);
deepEqual(
  core.normalizeRecurringBounds({ fixed_day: " שני ", fixed_time: "10:00 ", fixed_start_date: "2026-01-01", fixed_end_date: "2026-12-31" }),
  { fixedDay: "שני", fixedTime: "10:00", startDate: "2026-01-01", endDate: "2026-12-31" }
);
deepEqual(core.recurringSeriesDates("שני", "2026-09-02", "2026-09-30"), ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
deepEqual(core.recurringSeriesDates("שני", "2026-09-07", "2026-09-07"), ["2026-09-07"]);
deepEqual(core.recurringSeriesDates("nope", "2026-09-02", "2026-09-30"), []);
deepEqual(core.recurringSeriesDates("שני", "2026-09-30", "2026-09-02"), []);
assert.equal(core.recurringSeriesDates("שני", "2020-01-01", "2040-01-01").length, core.MAX_RECURRING_OCCURRENCES + 1, "open-ended series are capped");

const fixedPatient = { id: "p1", fixed_day: "שני", fixed_time: "10:00", fixed_start_date: "2026-01-01", fixed_end_date: "2026-12-31" };
deepEqual(core.recurringSeriesSlot({ session_date: "2026-09-07" }, fixedPatient), { patientId: "p1", dateValue: "2026-09-07" });
assert.equal(core.recurringSeriesSlot({ session_date: "2026-09-08" }, fixedPatient), null, "a different weekday is not on the series");
assert.equal(core.recurringSeriesSlot({ session_date: "2025-12-29" }, fixedPatient), null);
assert.equal(core.recurringSeriesSlot({ session_date: "2027-01-04" }, fixedPatient), null);
assert.equal(core.recurringSeriesSlot({ session_date: "2026-09-07" }, { id: "p2" }), null);
assert.equal(core.recurringSeriesSlot({ session_date: "07/09/2026" }, fixedPatient), null);
deepEqual(core.recurringSeriesSlot({ session_date: "2026-09-07" }, { id: "p3", fixed_day: "שני", fixed_time: "10:00" }), { patientId: "p3", dateValue: "2026-09-07" });

assert.equal(core.sessionEndTimeValue({ start_time: "10:00", end_time: "10:45" }), "10:45");
assert.equal(core.sessionEndTimeValue({ start_time: "10:00" }), "10:50");
assert.equal(core.sessionEndTimeValue({}), "");

for (const key of Object.keys(api)) {
  assert.ok(covered.has(key), `schedule-core export without a test: ${key}`);
}
console.log(`schedule-core tests passed (${Object.keys(api).length} exports covered)`);
