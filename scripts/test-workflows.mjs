import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../docs/workflow-core.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const core = context.globalThis.CLINIC_WORKFLOW_CORE;

for (const table of ["goals", "goal_updates", "questionnaire_templates", "questionnaire_assignments", "questionnaire_responses", "clinical_reports", "business_records", "session_charges", "payment_allocations"]) {
  assert.ok(core.TABLES.includes(table), `${table} must participate in audit snapshots and backup validation`);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyMutation(store, mutation) {
  const rows = store[mutation.table];
  const index = rows.findIndex((row) => row.id === (mutation.before?.id || mutation.after?.id));
  if (!mutation.after && index >= 0) rows.splice(index, 1);
  else if (index >= 0) rows[index] = { ...mutation.after };
  else rows.push({ ...mutation.after });
}

const empty = Object.fromEntries(core.TABLES.map((table) => [table, []]));
const beforeStore = {
  ...empty,
  tasks: [{ id: "task-1", title: "ישן", status: "open", _rowNumber: "2" }],
  payments: [{ id: "pay-1", payment_status: "unpaid", _rowNumber: "2" }]
};
const afterStore = {
  ...empty,
  tasks: [
    { id: "task-1", title: "חדש", status: "open", _rowNumber: "2" },
    { id: "task-2", title: "קבלה", status: "open", _rowNumber: "3" }
  ],
  payments: [{ id: "pay-1", payment_status: "paid", _rowNumber: "2" }]
};
const before = core.snapshot(beforeStore);
const after = core.snapshot(afterStore);
const mutations = plain(core.diff(before, after));
assert.equal(mutations.length, 3, "one business action should capture all linked row changes");

const restored = plain(afterStore);
for (const mutation of plain(core.inverse(mutations))) applyMutation(restored, mutation);
const withoutRows = (snapshot) => Object.fromEntries(
  Object.entries(snapshot).map(([table, rows]) => [table, rows.map((row) => core.cleanRecord(row))])
);
assert.deepEqual(withoutRows(core.snapshot(restored)), withoutRows(before), "undo should reverse every mutation in reverse order");

const loadedTask = { id: "task-1", title: "מקורי", status: "open", _rowNumber: "2" };
loadedTask._loadedVersion = core.recordVersion(loadedTask);
assert.equal(core.rowConflict({ ...loadedTask }, loadedTask), false, "unchanged remote row should remain writable");
assert.equal(
  core.rowConflict({ ...loadedTask, title: "נערך במקום אחר" }, loadedTask),
  true,
  "a concurrent edit must be detected before writing"
);
assert.equal(
  core.rowConflict({ ...loadedTask, id: "task-replaced" }, loadedTask),
  true,
  "a row replaced or moved by another user must be detected"
);
assert.equal(core.rowConflict(null, loadedTask), true, "a concurrently deleted row must be detected");
assert.equal(core.cleanRecord(loadedTask)._loadedVersion, undefined, "local concurrency metadata must not enter audit or backup data");

assert.equal(core.reminderState({ status: "open", reminder_at: "2026-07-12" }, "2026-07-13"), "overdue");
assert.equal(core.reminderState({ status: "open", reminder_at: "2026-07-13" }, "2026-07-13"), "today");
assert.equal(core.reminderState({ status: "done", reminder_at: "2026-07-12" }, "2026-07-13"), "inactive");

assert.equal(core.googleFailure(401, "Invalid Credentials"), "reauth");
assert.equal(core.googleFailure(403, "API has not been used in project"), "api_disabled");
assert.equal(core.googleFailure(403, "insufficient permissions"), "permission");
assert.equal(core.googleFailure(429, "quota"), "rate_limit");
assert.equal(core.googleFailure(503, "backend error"), "temporary");

const validBackup = {
  app: "clinic-manager",
  data: Object.fromEntries([...core.TABLES, "audit_log"].map((table) => [table, []]))
};
assert.equal(core.validateBackup(validBackup, [...core.TABLES, "audit_log"]), true);
assert.throws(
  () => core.validateBackup({ app: "clinic-manager", data: { ...validBackup.data, tasks: [{ id: "x" }, { id: "x" }] } }, [...core.TABLES, "audit_log"]),
  /כפול/
);
assert.throws(
  () => core.validateBackup({ app: "other", data: {} }, [...core.TABLES, "audit_log"]),
  /אינו שייך/
);

// Simulate a restore failure after one table and verify the saved snapshot restores all tables.
const live = plain(beforeStore);
const rollback = plain(live);
try {
  live.tasks = plain(afterStore.tasks);
  throw new Error("simulated Sheets failure");
} catch {
  for (const table of core.TABLES) live[table] = plain(rollback[table]);
}
assert.deepEqual(live, rollback, "failed restore should roll back to the complete pre-restore snapshot");

// Backups never carry the audit log; a restore validates only the business tables.
assert.deepEqual(plain(core.BACKUP_EXCLUDED_TABLES), ["audit_log"]);
const restoreTables = core.backupTables([...core.TABLES, "audit_log"]);
assert.ok(!restoreTables.includes("audit_log"), "audit_log must never be restored or wiped");
assert.deepEqual(plain(restoreTables), plain(core.TABLES), "every business table stays in the backup");
const backupWithoutAudit = { app: "clinic-manager", data: Object.fromEntries(core.TABLES.map((table) => [table, []])) };
assert.equal(core.validateBackup(backupWithoutAudit, restoreTables), true, "a backup without audit_log must be accepted");
assert.equal(
  core.validateBackup({ ...backupWithoutAudit, data: { ...backupWithoutAudit.data, audit_log: [{ id: "a1" }] } }, restoreTables),
  true,
  "an older backup that still carries audit_log must be accepted"
);

console.log("Workflow tests: concurrency, audit/undo, reminders, Google failures, backup validation and restore rollback: ok");

// Config overrides: only whitelisted keys may replace config.js values.
assert.ok(!core.OVERRIDABLE_CONFIG_KEYS.includes("googleClientId"), "googleClientId must never be overridable");
for (const key of ["googleDriveRootFolderId", "googleTemplatesFolderId", "googleSpreadsheetId", "googleCalendarId", "allowedUserEmails", "appName", "sessionTypes", "sessionLocations"]) {
  assert.ok(core.OVERRIDABLE_CONFIG_KEYS.includes(key), `${key} is edited by the Settings form and must stay overridable`);
}
assert.deepEqual(
  plain(core.pickOverridableConfig({
    googleClientId: "attacker.apps.googleusercontent.com",
    googleSpreadsheetId: "sheet-1",
    allowedUserEmails: ["a@example.com", 7],
    appName: "קליניקה",
    __proto__: { polluted: "yes" },
    unknownKey: "x"
  })),
  { googleSpreadsheetId: "sheet-1", allowedUserEmails: ["a@example.com"], appName: "קליניקה" },
  "only whitelisted string/list keys survive"
);
assert.deepEqual(plain(core.pickOverridableConfig({ googleSpreadsheetId: { nested: true } })), {}, "non-string values are dropped");
assert.deepEqual(plain(core.pickOverridableConfig(null)), {});
assert.deepEqual(plain(core.pickOverridableConfig("text")), {});
assert.deepEqual(plain(core.pickOverridableConfig(["googleSpreadsheetId"])), {});

// Links: only http(s), mailto and tel URLs may reach an href.
assert.equal(core.safeHref("https://drive.google.com/file/d/abc/view"), "https://drive.google.com/file/d/abc/view");
assert.equal(core.safeHref("  http://example.com/x "), "http://example.com/x");
assert.equal(core.safeHref("mailto:parent@example.com"), "mailto:parent@example.com");
assert.equal(core.safeHref("tel:+972501234567"), "tel:+972501234567");
assert.equal(core.safeHref("javascript:alert(1)"), "#");
assert.equal(core.safeHref("JaVaScRiPt:alert(1)"), "#");
assert.equal(core.safeHref("data:text/html,<script>alert(1)</script>"), "#");
assert.equal(core.safeHref("vbscript:msgbox"), "#");
assert.equal(core.safeHref("//evil.example"), "#");
assert.equal(core.safeHref(""), "#");
assert.equal(core.safeHref(null), "#");
assert.equal(core.safeHref(undefined), "#");

// Sharing audit: public grants are repaired, foreign grants are reported.
const classified = core.classifySharingPermissions(
  [
    { id: "p-anyone", type: "anyone", role: "reader" },
    { id: "p-owner", type: "user", role: "owner", emailAddress: "Owner@Example.com" },
    { id: "p-spouse", type: "user", role: "writer", emailAddress: "spouse@example.com" },
    { id: "p-stranger", type: "user", role: "reader", emailAddress: "stranger@example.com" },
    { id: "p-domain", type: "domain", role: "reader", domain: "example.org" },
    { id: "p-group", type: "group", role: "reader", emailAddress: "team@example.org" },
    { id: "p-hidden", type: "user", role: "reader" },
    null
  ],
  ["owner@example.com", " SPOUSE@example.com "]
);
assert.deepEqual(plain(classified.publicPermissions.map((item) => item.id)), ["p-anyone"]);
assert.deepEqual(
  plain(classified.foreignPermissions.map((item) => [item.id, item.subject])),
  [["p-stranger", "stranger@example.com"], ["p-domain", "example.org"], ["p-group", "team@example.org"], ["p-hidden", ""]],
  "allowlisted users are not reported; domain, group, unknown and hidden users are"
);
assert.deepEqual(plain(core.classifySharingPermissions([], [])), { publicPermissions: [], foreignPermissions: [] });
assert.deepEqual(plain(core.classifySharingPermissions(undefined, undefined)), { publicPermissions: [], foreignPermissions: [] });

console.log("Workflow tests: config override whitelist, safe links and sharing classification: ok");

// Scheduling conflict detection used by the calendar and session workflows.
const busyDay = [{ id: "s1", start_time: "10:00", end_time: "10:50" }];
const fullHit = core.findScheduleConflict({ startTime: "10:00", endTime: "10:50" }, busyDay);
assert.equal(fullHit.kind, "full", "an identical slot must be a full overlap");
assert.equal(fullHit.occupiedRange, "10:00-10:50", "the conflict must report the occupied range");
assert.equal(fullHit.appointment.id, "s1", "the conflicting appointment must be identified");
const partialHit = core.findScheduleConflict({ startTime: "10:30", endTime: "11:15" }, busyDay);
assert.equal(partialHit.kind, "partial", "a partly overlapping slot must be a partial overlap");
assert.equal(
  core.findScheduleConflict({ startTime: "11:00", endTime: "11:50" }, busyDay),
  null,
  "back-to-back appointments must not be flagged as a conflict"
);
assert.equal(
  core.findScheduleConflict({ startTime: "10:00", endTime: "10:50", excludeIds: ["s1"] }, busyDay),
  null,
  "editing an appointment must not conflict with itself"
);
assert.equal(
  core.findScheduleConflict({ startTime: "", endTime: "" }, busyDay),
  null,
  "a slot without a start time cannot conflict"
);
assert.deepEqual(
  [...core.suggestFreeSlots({ startTime: "10:00", endTime: "10:50" }, busyDay)],
  ["09:00", "11:00"],
  "nearby free slots must be offered before and after the occupied range"
);

console.log("Workflow tests: schedule conflict detection and free-slot suggestions: ok");

// ---- Google API retry policy ----------------------------------------------------------
assert.equal(core.RETRY_MAX_ATTEMPTS, 4, "at most four attempts");
assert.equal(core.shouldRetryGoogle(429, 1), true, "rate limits retry");
assert.equal(core.shouldRetryGoogle(503, 3), true, "server errors retry");
assert.equal(core.shouldRetryGoogle(0, 1), true, "network failures retry");
assert.equal(core.shouldRetryGoogle(404, 1), false, "client errors do not retry");
assert.equal(core.shouldRetryGoogle(429, 4), false, "the attempt limit stops retries");
assert.equal(core.retryDelayMs(1, { random: () => 0 }), 250, "first delay lower bound (half of 500ms)");
assert.equal(core.retryDelayMs(1, { random: () => 1 }), 500, "first delay upper bound");
assert.equal(core.retryDelayMs(3, { random: () => 0.5 }), 1500, "third delay grows exponentially");
assert.equal(core.retryDelayMs(10, { random: () => 1 }), 8000, "delays are capped");
assert.equal(core.retryDelayMs(1, { retryAfter: "2" }), 2000, "Retry-After seconds win over backoff");
assert.equal(core.retryDelayMs(1, { retryAfter: "120" }), 30000, "Retry-After is capped");
assert.equal(
  core.retryDelayMs(1, { retryAfter: "Wed, 02 Sep 2026 10:00:03 GMT", now: Date.parse("2026-09-02T10:00:00Z") }),
  3000,
  "Retry-After HTTP dates are honored"
);
console.log("Workflow tests: Google retry policy: ok");

// ---- Audit mutation cap and pruning ----------------------------------------------------
const smallCap = core.capAuditMutations([{ table: "tasks", rowNumber: "2", before: null, after: { id: "t1" } }]);
assert.equal(smallCap.truncated, false, "small mutation lists are stored verbatim");
const bigMutations = Array.from({ length: 60 }, (_, index) => ({
  table: "sessions",
  rowNumber: String(index + 2),
  before: null,
  after: { id: `s${index}`, summary: "x".repeat(1000) }
}));
const capped = core.capAuditMutations(bigMutations);
assert.equal(capped.truncated, true, "oversized mutation lists are truncated");
assert.ok(capped.json.length <= core.AUDIT_MUTATIONS_MAX_CHARS, "the truncated form fits the cell limit");
const cappedParsed = JSON.parse(capped.json);
assert.equal(cappedParsed.truncated, true);
assert.equal(cappedParsed.note, core.AUDIT_TOO_LARGE_NOTE);
assert.equal(cappedParsed.count, 60);
assert.deepEqual(plain(cappedParsed.rows[0]), { table: "sessions", rowNumber: "2", id: "s0" }, "row references survive truncation");
assert.deepEqual(plain(JSON.parse(core.capAuditMutations(bigMutations, 200).json).rows), [], "row references are dropped when even they do not fit");
assert.equal(core.AUDIT_LOG_MAX_ROWS, 400);
const auditEntries = [
  { _rowNumber: "2", created_at: "2026-01-03" },
  { _rowNumber: "3", created_at: "2026-01-01" },
  { _rowNumber: "4", created_at: "2026-01-02" },
  { _rowNumber: "5", created_at: "2026-01-04" }
];
assert.deepEqual(plain(core.auditRowsToPrune(auditEntries, 2)), [3, 4], "the oldest entries beyond the cap are pruned");
assert.deepEqual(plain(core.auditRowsToPrune(auditEntries, 4)), [], "nothing is pruned under the cap");
console.log("Workflow tests: audit mutation cap and pruning: ok");

// ---- Row deletion planning -------------------------------------------------------------
assert.equal(core.BLANK_ROW_COMPACTION_THRESHOLD, 20);
assert.deepEqual(plain(core.blankRowNumbers([["a"], [], ["", " "], ["b"], [""]])), [3, 4, 6], "fully blank rows are located by sheet row number");
assert.deepEqual(
  plain(core.rowDeleteRanges([2, 3, 4, 7, 9, 10])),
  [
    { startIndex: 8, endIndex: 10 },
    { startIndex: 6, endIndex: 7 },
    { startIndex: 1, endIndex: 4 }
  ],
  "contiguous rows merge into 0-based ranges ordered bottom-up"
);
assert.deepEqual(plain(core.rowDeleteRanges([5, 5, 1, 0])), [{ startIndex: 4, endIndex: 5 }], "duplicates and the header row are ignored");
assert.deepEqual(
  plain(core.deleteRowRequests(7, [2, 3])),
  [{ deleteDimension: { range: { sheetId: 7, dimension: "ROWS", startIndex: 1, endIndex: 3 } } }],
  "delete requests target the sheet id"
);
console.log("Workflow tests: blank-row compaction planning: ok");

// ---- Duplicate patient detection -------------------------------------------------------
const knownPatients = [
  { id: "p1", child_name: "נועם  כהן", status: "active" },
  { id: "p2", child_name: "Dana", status: "archived" }
];
assert.equal(core.normalizePatientName("  Dana   Levi "), "dana levi", "names are trimmed, lowercased and whitespace-collapsed");
assert.equal(core.findDuplicatePatient(" נועם כהן ", knownPatients)?.id, "p1", "a matching active patient is a duplicate");
assert.equal(core.findDuplicatePatient("dana", knownPatients), null, "archived patients are not duplicates");
assert.equal(core.findDuplicatePatient("נועם כהן", knownPatients, "p1"), null, "an edited patient never matches itself");
assert.equal(core.findDuplicatePatient("", knownPatients), null, "an empty name has no duplicate");
console.log("Workflow tests: duplicate patient detection: ok");

// ---- Calendar week/day layout ----------------------------------------------------------
assert.deepEqual(plain(core.CALENDAR_VIEWS), ["month", "week", "day"]);
assert.deepEqual(
  plain(core.weekRangeForDate("2026-09-07")),
  {
    start: "2026-09-06",
    end: "2026-09-12",
    dates: ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"]
  },
  "a week starts on Sunday and ends on Saturday"
);
assert.equal(core.weekRangeForDate("2026-09-06").start, "2026-09-06", "Sunday starts its own week");
assert.equal(core.weekRangeForDate("2026-09-12").start, "2026-09-06", "Saturday belongs to the week that started the previous Sunday");
assert.equal(core.weekRangeForDate("bad"), null);
assert.equal(core.shiftIsoDate("2026-12-31", 1), "2027-01-01", "day shifts roll over years");
assert.equal(core.shiftCalendarDate("2026-09-07", "week", 1), "2026-09-14");
assert.equal(core.shiftCalendarDate("2026-09-07", "week", -1), "2026-08-31");
assert.equal(core.shiftCalendarDate("2026-09-30", "day", 1), "2026-10-01");
assert.equal(core.shiftCalendarDate("2026-09-01", "day", -1), "2026-08-31");
assert.equal(core.shiftCalendarDate("2026-01-31", "month", 1), "2026-02-28", "month shifts clamp to the last day");
assert.equal(core.shiftCalendarDate("2026-01-15", "month", -1), "2025-12-15");

assert.deepEqual(
  plain(core.calendarTimeBounds([], {})),
  { startMinutes: 7 * 60, endMinutes: 21 * 60 },
  "no settings means 07:00–21:00"
);
assert.deepEqual(
  plain(core.calendarTimeBounds([], { dayStart: "08:30", dayEnd: "17:15" })),
  { startMinutes: 8 * 60, endMinutes: 18 * 60 },
  "configured hours are widened to whole hours"
);
assert.deepEqual(
  plain(core.calendarTimeBounds([{ start_time: "06:20", end_time: "07:00" }, { start_time: "21:30", end_time: "" }], {})),
  { startMinutes: 6 * 60, endMinutes: 23 * 60 },
  "sessions outside the working hours expand the grid"
);
assert.deepEqual(plain(core.hourLabels(7 * 60, 10 * 60)), ["07:00", "08:00", "09:00"]);

const layout = core.layoutDaySlots(
  [
    { id: "a", start_time: "10:00", end_time: "11:00" },
    { id: "b", start_time: "10:30", end_time: "11:20" },
    { id: "c", start_time: "12:00", end_time: "" },
    { id: "d", start_time: "", end_time: "" }
  ],
  { startMinutes: 7 * 60, endMinutes: 21 * 60 }
);
assert.deepEqual(
  plain(layout.slots.map((slot) => [slot.id, slot.top, slot.length, slot.column, slot.columns])),
  [
    ["a", 180, 60, 0, 2],
    ["b", 210, 50, 1, 2],
    ["c", 300, 50, 0, 1]
  ],
  "overlapping sessions share columns; a session without end time gets the default length"
);
assert.deepEqual(plain(layout.untimed.map((session) => session.id)), ["d"], "sessions without a start time are listed separately");
assert.equal(
  core.layoutDaySlots([{ id: "x", start_time: "09:00", end_time: "09:45" }], { startMinutes: 9 * 60 }).slots[0].top,
  0,
  "top is measured from the grid start"
);
console.log("Workflow tests: calendar week/day layout: ok");

// ---- Global search ---------------------------------------------------------------------
assert.equal(core.normalizePhoneDigits("+972 50-123 4567"), "0501234567", "+972 becomes a leading 0");
assert.equal(core.normalizePhoneDigits("050-1234567"), "0501234567");
assert.equal(core.normalizePhoneDigits(""), "");
assert.equal(core.normalizeSearchText("  שָׁלוֹם   עוֹלָם "), "שלום עולם", "niqqud and extra spaces are ignored");

const searchPatients = [
  { id: "p1", child_name: "אורי לוי", school_name: "בית ספר אורנים", address: "רחוב הרצל 5, חיפה" },
  { id: "p2", child_name: "נועה כהן", school_name: "גן אורן", address: "" },
  { id: "p3", child_name: "דניאל אור", school_name: "", address: "" },
  { id: "p4", child_name: "", school_name: "", address: "" }
];
const searchContacts = [
  { patient_id: "p1", contact_type: "parent", name: "רונית לוי", phone: "+972-50-1234567", email: "ronit@example.com" },
  { patient_id: "p2", contact_type: "parent", name: "יוסי כהן", phone: "052-7654321", email: "" },
  { patient_id: "p2", contact_type: "professional", name: "מיכל ברק", phone: "03-5551234", relationship: "גננת", organization: "גן אורן" },
  { patient_id: "missing", contact_type: "parent", name: "אין מטופל", phone: "0500000000", email: "" }
];
const index = core.searchIndex(searchPatients, searchContacts);
assert.equal(index.entries.some((entry) => entry.patientId === "missing"), false, "contacts without a patient are skipped");
assert.equal(index.entries.some((entry) => entry.patientId === "p4"), false, "patients without a name produce no entries");

assert.deepEqual(plain(core.globalSearch(index, "א")), [], "a single character never searches");
const byPhone = core.globalSearch(index, "0501234");
assert.deepEqual(
  plain(byPhone.map((item) => [item.patientId, item.field, item.fieldLabel])),
  [["p1", "parent_phone", "טלפון הורה"]],
  "phone digits match the parent phone regardless of formatting"
);
assert.equal(core.globalSearch(index, "+972 50 1234")[0]?.patientId, "p1", "+972 prefixes match stored 05x numbers");
assert.equal(core.globalSearch(index, "1234")[0]?.patientId, "p1", "digits in the middle of a phone still match");
assert.equal(core.globalSearch(index, "555")[0]?.field, "contact_phone", "professional phones match too");

const byName = core.globalSearch(index, "אור");
assert.deepEqual(
  plain(byName.map((item) => [item.patientId, item.field])),
  [
    ["p1", "child_name"],
    ["p3", "child_name"],
    ["p2", "school"]
  ],
  "child-name matches rank first (prefix before word-prefix), then school matches"
);
assert.deepEqual(
  plain(core.globalSearch(index, "גן אורן").map((item) => [item.patientId, item.field, item.value])),
  [["p2", "school", "גן אורן"]],
  "school text matches and reports the matched value"
);
assert.equal(core.globalSearch(index, "רונית")[0]?.fieldLabel, "שם הורה", "parent names carry their Hebrew label");
assert.equal(core.globalSearch(index, "ronit@")[0]?.field, "parent_email");
assert.equal(core.globalSearch(index, "גננת")[0]?.field, "contact_role");
assert.equal(core.globalSearch(index, "הרצל")[0]?.field, "address");
assert.equal(core.globalSearch(index, "לוי").length, 1, "each patient appears once even when several fields match");
assert.equal(core.globalSearch(index, "לוי")[0].field, "child_name", "the best field for a patient wins");
assert.equal(core.globalSearch(index, "אור", 2).length, 2, "the limit caps the result count");
assert.deepEqual(plain(core.globalSearch(null, "אור")), []);
console.log("Workflow tests: global search: ok");
