import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// format-core resolves CLINIC_BUSINESS_CORE lazily for money formatting, so both cores share one context.
const context = { module: { exports: {} }, globalThis: {} };
for (const file of ["business-core.js", "format-core.js"]) {
  vm.runInNewContext(readFileSync(new URL(`../docs/${file}`, import.meta.url), "utf8"), context);
}
const api = context.globalThis.CLINIC_FORMAT_CORE;

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

// Hebrew punctuation is built from code points so this file stays free of the mojibake sentinel.
const GERESH = String.fromCharCode(0x05f3);
const GERSHAYIM = String.fromCharCode(0x05f4);

// Report types and labels.
assert.equal(core.REPORT_TYPES.assessment, "דוח אבחון");
deepEqual(Object.keys(core.REPORT_TYPES), ["assessment", "progress", "summary"]);
assert.equal(core.reportTypeLabel("summary"), "דוח סיכום טיפול");
assert.equal(core.reportTypeLabel("nope"), "דוח התקדמות");
assert.equal(core.goalStatusLabel("achieved"), "הושגה");
assert.equal(core.goalStatusLabel(""), "פעילה");
assert.equal(core.questionnaireStatusLabel("sent"), "נשלח");
assert.equal(core.questionnaireStatusLabel(undefined), "טיוטה");
assert.equal(core.contactTypeLabel("professional"), "איש/אשת מקצוע");
assert.equal(core.contactTypeLabel("parent"), "הורה או בן משפחה");
assert.equal(core.taskStatusLabel("done"), "בוצעה");
assert.equal(core.taskStatusLabel("weird"), "פתוחה");
assert.equal(core.fileTypeLabel("receipt"), "קבלה");
assert.equal(core.fileTypeLabel(""), "מסמך");
assert.equal(core.chargeStatusLabel("paid"), "שולם");
assert.equal(core.chargeStatusLabel("partial"), "שולם חלקית");
assert.equal(core.chargeStatusLabel("open"), "פתוח");
assert.equal(core.businessTypeLabel("income"), "הכנסה");
assert.equal(core.businessTypeLabel("expense"), "הוצאה");
assert.equal(core.businessTypeLabel(""), "-");
assert.equal(core.businessTypeLabel("other"), "other");
assert.equal(core.exceptionTypeLabel("vacation"), "חופשה");
assert.equal(core.exceptionTypeLabel("holiday_pending"), "ממתין להחלטה (חג)");
assert.equal(core.exceptionTypeLabel("x"), "חריג יומן");
assert.equal(core.paymentStatusLabel("none"), "ללא חיובים");
assert.equal(core.paymentStatusLabel("?"), "פתוח");
assert.equal(core.paymentMethodLabel("cash"), "מזומן");
assert.equal(core.paymentMethodLabel(""), "העברה");
assert.equal(core.receiptStatusLabel("issued"), "הופקה קבלה");
assert.equal(core.receiptStatusLabel(""), "דרושה קבלה");
assert.equal(core.NO_SHOW_POLICY_LABELS.half, "חצי מחיר");
deepEqual(Object.keys(core.NO_SHOW_POLICY_LABELS), ["none", "full", "half", "fixed"]);

// Status tones.
assert.equal(core.PAYMENT_STATUS_TONES.paid, "success");
assert.equal(core.PAYMENT_STATUS_TONES.unpaid, "danger");
assert.equal(core.CHARGE_STATUS_TONES.open, "danger");
assert.equal(core.CHARGE_STATUS_TONES.cancelled, "");
assert.equal(core.RECEIPT_STATUS_TONES.needed, "warning");
assert.equal(core.RECEIPT_STATUS_TONES.not_needed, "");

// Sharing warnings.
assert.equal(core.sharingWarningText({ type: "domain", subject: "clinic.example" }), "שיתוף לכל הדומיין clinic.example");
assert.equal(core.sharingWarningText({ type: "group" }), "שיתוף לקבוצה לא מזוהה");
assert.equal(core.sharingWarningText({ type: "user", subject: "a@b.c" }), "שיתוף לחשבון שאינו ברשימת המורשים: a@b.c");
assert.equal(core.sharingWarningText({ type: "user" }), "שיתוף לחשבון שאינו ברשימת המורשים: משתמש לא מזוהה");

// Dates and times.
assert.equal(core.formatDateTime(""), "טרם בוצע");
assert.match(core.formatDateTime("2026-09-02T10:30:00"), /2026/);
assert.match(core.formatDateTime("2026-09-02T10:30:00"), /10:30/);
assert.equal(core.formatDate(""), "-");
assert.equal(core.formatDate("2026-09-02"), "2.9.2026");
assert.equal(core.isoDate(new Date(2026, 8, 2)), "2026-09-02");
assert.match(core.monthLabel("2026-09"), /ספטמבר/);
assert.match(core.monthLabel("2026-09"), /2026/);
assert.equal(core.shiftMonth("2026-12", 1), "2027-01");
assert.equal(core.shiftMonth("2026-01", -1), "2025-12");
assert.equal(core.shiftMonth("2026-05", 0), "2026-05");

const days = core.calendarDays("2026-09");
assert.equal(days.length, 42);
deepEqual(days[0], { date: "2026-08-30", inMonth: false });
deepEqual(days[2], { date: "2026-09-01", inMonth: true });
assert.equal(days.filter((day) => day.inMonth).length, 30);

assert.equal(core.dateFromInput("2026-09-02").getDate(), 2);
assert.equal(core.dateFromInput("2026-09-02").getHours(), 0);
assert.ok(!Number.isNaN(core.dateFromInput("not-a-date").getTime()));
assert.equal(typeof core.dateFromInput("").getTime(), "number");

deepEqual(core.timeParts("9:15"), { hour: 9, minute: "15" });
deepEqual(core.timeParts("25:10"), { hour: 23, minute: "00" });
const fallbackParts = core.timeParts("bad");
assert.ok(fallbackParts.hour >= 0 && fallbackParts.hour <= 23);
assert.equal(fallbackParts.minute, "00");

assert.equal(core.hebrewWeekday(new Date(2026, 8, 2)), "יום רביעי");
assert.equal(core.hebrewWeekday(new Date(2026, 8, 5)), "שבת");
deepEqual(core.HEBREW_WEEKDAY_NAMES, ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]);
assert.equal(core.weekdayIndex("2026-09-02"), 3);
assert.equal(core.weekdayIndex("2026-09-06"), 0);

assert.equal(core.addDaysToDate("2026-12-30", 3), "2027-01-02");
assert.equal(core.addDaysToDate("2026-03-01", -1), "2026-02-28");
assert.equal(core.maxDateValue("2026-01-01", "2025-12-31"), "2026-01-01");
assert.equal(core.maxDateValue("2025-01-01", "2025-12-31"), "2025-12-31");
deepEqual(core.dateRange("2026-09-02", 3), ["2026-09-02", "2026-09-03", "2026-09-04"]);
deepEqual(core.dateRange("2026-09-02", 0), []);

assert.equal(core.calendarDateTime("2026-09-02", ""), null);
assert.equal(core.calendarDateTime("", "10:00"), null);
assert.equal(core.calendarDateTime("2026-09-02", "10:00"), "2026-09-02T10:00:00");
assert.equal(core.addMinutes("10:00", 50), "10:50");
assert.equal(core.addMinutes("23:30", 45), "00:15");
assert.equal(core.addMinutes("", 10), "00:10");

// Hebrew calendar.
assert.equal(core.hebrewGematria(0), "");
assert.equal(core.hebrewGematria(1000), "");
assert.equal(core.hebrewGematria("abc"), "");
assert.equal(core.hebrewGematria(1), `א${GERESH}`);
assert.equal(core.hebrewGematria(20), `כ${GERESH}`);
assert.equal(core.hebrewGematria(100), `ק${GERESH}`);
assert.equal(core.hebrewGematria(15), `ט${GERSHAYIM}ו`);
assert.equal(core.hebrewGematria(16), `ט${GERSHAYIM}ז`);
assert.equal(core.hebrewGematria(786), `תשפ${GERSHAYIM}ו`);
assert.equal(core.hebrewGematria(999), `תתקצ${GERSHAYIM}ט`);

assert.equal(core.hebrewDateParts("bad"), null);
assert.equal(core.hebrewDateParts(""), null);
// 2 September 2026 is 20 Elul 5786.
const elul = core.hebrewDateParts("2026-09-02");
assert.equal(elul.month, "אלול");
assert.equal(elul.day, `כ${GERESH}`);
assert.equal(elul.year, `תשפ${GERSHAYIM}ו`);
assert.equal(elul.short, `כ${GERESH} באלול`);
assert.equal(elul.full, `כ${GERESH} באלול תשפ${GERSHAYIM}ו`);
assert.equal(core.hebrewDateParts("2026-09-02"), elul, "repeated lookups are served from the cache");

// Money.
assert.equal(core.formatAmount("abc"), "abc");
assert.equal(core.formatAmount(undefined), "-");
assert.match(core.formatAmount(300), /300/);
assert.match(core.formatAmount(300), /₪/);
assert.doesNotMatch(core.formatAmount(300.4), /\.4/);
assert.match(core.formatAgorotAmount(30050), /300\.50/);
assert.match(core.formatAgorotAmount(7), /0\.07/);
assert.equal(core.formatBusinessAmount("abc"), "abc");
assert.equal(core.formatBusinessAmount(""), "-");
assert.match(core.formatBusinessAmount("300"), /300\.00/);

// Patients, contacts and sessions.
const contacts = [
  { patient_id: "p1", contact_type: "professional", name: "רופאה" },
  { patient_id: "p1", contact_type: "parent", name: "אמא" },
  { patient_id: "p2", contact_type: "professional", name: "יועץ" }
];
assert.equal(core.primaryContact(contacts, "p1").name, "אמא");
assert.equal(core.primaryContact(contacts, "p2").name, "יועץ");
assert.equal(core.primaryContact(contacts, "p3"), null);
const patients = [{ id: "p1", child_name: "נועם" }];
assert.equal(core.patientDisplayName(patients, "p1"), "נועם");
assert.equal(core.patientDisplayName(patients, "p9"), "ללא מטופל");
assert.equal(core.sessionLabel(null), "מפגש");
assert.equal(
  core.sessionLabel({ session_date: "2026-09-02", start_time: "10:00", end_time: "10:45", session_type: "טיפול" }),
  "2.9.2026 | 10:00-10:45 | טיפול"
);
assert.equal(core.sessionLabel({ session_date: "2026-09-02", start_time: "10:00" }), "2.9.2026 | 10:00 | מפגש");
assert.match(core.sessionToneClass({ session_type: "טיפול" }), /^tone-[1-5]$/);
assert.equal(core.sessionToneClass({ session_type: "טיפול" }), core.sessionToneClass({ session_type: "טיפול" }));
assert.equal(core.sessionToneClass({}), "tone-1");
assert.equal(
  core.sessionDocumentTitle({ child_name: "נועם" }, { session_date: "2026-09-02", id: "abcdefghij" }),
  "תיעוד מפגש - נועם - 2026-09-02 - abcdefgh"
);
assert.equal(core.sessionDocumentTitle({}, { session_date: "2026-09-02", id: "s1" }), "תיעוד מפגש - מטופל - 2026-09-02 - s1");

// Schedule exceptions.
assert.equal(core.formatExceptionDateRange(null), "-");
assert.equal(core.formatExceptionDateRange({ start_date: "2026-09-02" }), "2.9.2026");
assert.equal(core.formatExceptionDateRange({ start_date: "2026-09-02", end_date: "2026-09-02" }), "2.9.2026");
assert.equal(core.formatExceptionDateRange({ start_date: "2026-09-02", end_date: "2026-09-04" }), "2.9.2026 - 4.9.2026");

// Audit.
deepEqual(core.auditMutations({ mutations_json: '[{"op":"set"}]' }), [{ op: "set" }]);
deepEqual(core.auditMutations({ mutations_json: "{bad" }), []);
deepEqual(core.auditMutations({ mutations_json: '{"op":"set"}' }), []);
deepEqual(core.auditMutations(null), []);

// Drive files.
assert.equal(core.driveFileTypeLabel("audio/webm"), "recording");
assert.equal(core.driveFileTypeLabel("application/pdf"), "document");
assert.equal(core.driveFileTypeLabel("application/vnd.google-apps.spreadsheet"), "document");
assert.equal(core.driveFileTypeLabel("image/png"), "form");
assert.equal(core.driveFileTypeLabel(), "other");
assert.equal(core.fileNameWithFallback("  קובץ.pdf ", null), "קובץ.pdf");
assert.equal(core.fileNameWithFallback("", { name: "f.pdf" }), "f.pdf");
assert.equal(core.fileNameWithFallback("", null), "");
assert.equal(core.escapeDriveQueryValue("a'b\\c"), "a\\'b\\\\c");
assert.equal(core.escapeDriveQueryValue(null), "");

// Archive messages.
const emptyImpact = { futureAuto: [], futureManual: [], pendingDecisions: [], outstandingAgorot: 0 };
const emptyMessage = core.archiveImpactMessage(emptyImpact);
assert.ok(emptyMessage.startsWith("סיום הטיפול יעצור את הלוח הקבוע של המטופל."));
assert.ok(emptyMessage.endsWith("ותמיד אפשר להחזיר מהארכיון."));
assert.doesNotMatch(emptyMessage, /יתרת חוב/);
const fullMessage = core.archiveImpactMessage({
  futureAuto: [1, 2],
  futureManual: [1],
  pendingDecisions: [1, 2, 3],
  outstandingAgorot: 30050
});
assert.match(fullMessage, /2 מפגשים קבועים עתידיים/);
assert.match(fullMessage, /1 מפגשים עתידיים נוספים/);
assert.match(fullMessage, /3 החלטות ממתינות/);
assert.match(fullMessage, /יתרת חוב פתוחה של .*300\.50/);
assert.equal(core.archiveDoneMessage(emptyImpact), "המטופל הועבר לארכיון.");
assert.match(core.archiveDoneMessage({ outstandingAgorot: 500 }), /^המטופל הועבר לארכיון\. שימי לב: נותרה יתרת חוב פתוחה של .*5\.00/);

// CSV and backups.
assert.equal(core.csvValue('a"b'), '"a""b"');
assert.equal(core.csvValue(null), '""');
assert.equal(core.csvValue(5), '"5"');
assert.match(core.backupFileName(), /^clinic-manager-backup-\d{4}-\d{2}-\d{2}\.json$/);
deepEqual(core.backupRows({ data: { tasks: [{ id: "t1", _rowNumber: 4 }] } }, "tasks"), [{ id: "t1" }]);
deepEqual(core.backupRows({ data: { tasks: "x" } }, "tasks"), []);
deepEqual(core.backupRows(null, "tasks"), []);

// Text lists.
assert.equal(core.listText(["a", "b"], "c", ["z"]), "a\nb");
assert.equal(core.listText("saved", "c", ["z"]), "saved");
assert.equal(core.listText("  ", ["d", "e"], ["z"]), "d\ne");
assert.equal(core.listText(undefined, "default", ["z"]), "default");
assert.equal(core.listText(undefined, " ", ["z", "y"]), "z\ny");
assert.equal(core.mergeListText("a\nb", "b,c", ""), "a\nb\nc");
assert.equal(core.mergeListText(), "");
assert.equal(core.savedListText([], "a,b"), "", "an empty saved list stays authoritative");
assert.equal(core.savedListText("", "a,b"), "");
assert.equal(core.savedListText(["x"], "a,b"), "x");
assert.equal(core.savedListText(undefined, "a,b"), "a\nb");
deepEqual(core.optionValues("a, b\r\nb", ["z"]), ["a", "b"]);
deepEqual(core.optionValues("", ["z", "z"]), ["z"]);
deepEqual(core.optionValues(null, []), []);

// Sheet rows.
deepEqual(core.rowToRecord(["id", "name"], ["1"]), { id: "1", name: "" });
deepEqual(core.recordToRow(["id", "name", "n"], { id: "1", name: "x", n: 0 }), ["1", "x", ""]);
assert.equal(core.columnLetter(0), "");
assert.equal(core.columnLetter(1), "A");
assert.equal(core.columnLetter(26), "Z");
assert.equal(core.columnLetter(27), "AA");
assert.equal(core.columnLetter(52), "AZ");
assert.equal(core.columnLetter(53), "BA");
assert.equal(core.appendedRowNumber({ updates: { updatedRange: "patients!A12:W12" } }), "12");
assert.equal(core.appendedRowNumber({ updates: { updatedRange: "patients!A12" } }), "");
assert.equal(core.appendedRowNumber(null), "");
assert.equal(core.stateCollectionName("schedule_exceptions"), "scheduleExceptions");
assert.equal(core.stateCollectionName("audit_log"), "auditLog");
assert.equal(core.stateCollectionName("goal_updates"), "goalUpdates");
assert.equal(core.stateCollectionName("questionnaire_templates"), "questionnaireTemplates");
assert.equal(core.stateCollectionName("questionnaire_assignments"), "questionnaireAssignments");
assert.equal(core.stateCollectionName("questionnaire_responses"), "questionnaireResponses");
assert.equal(core.stateCollectionName("clinical_reports"), "clinicalReports");
assert.equal(core.stateCollectionName("business_records"), "businessRecords");
assert.equal(core.stateCollectionName("session_charges"), "sessionCharges");
assert.equal(core.stateCollectionName("payment_allocations"), "paymentAllocations");
assert.equal(core.stateCollectionName("patients"), "patients");

// JSON, business records and forms.
deepEqual(plain(core.safeJson('{"a":1}')), { a: 1 });
deepEqual(core.safeJson("{bad"), []);
assert.equal(core.safeJson("", "fallback"), "fallback");
assert.equal(core.safeJson("null", "fallback"), "fallback");
const records = [
  { id: "a", document_date: "2026-01-01", created_at: "2026-01-01T09:00:00.000Z" },
  { id: "b", document_date: "2026-02-01", created_at: "2026-02-01T09:00:00.000Z" },
  { id: "c", document_date: "2026-02-01", created_at: "2026-02-01T10:00:00.000Z" }
];
deepEqual(core.sortBusinessRecords(records).map((record) => record.id), ["c", "b", "a"]);
deepEqual(records.map((record) => record.id), ["a", "b", "c"], "input order is not mutated");
deepEqual(plain(core.formQuestionRequest({ title: "שאלה", required: 1, type: "short" }, 2)), {
  createItem: {
    item: { title: "שאלה", questionItem: { question: { required: true, textQuestion: { paragraph: false } } } },
    location: { index: 2 }
  }
});
assert.equal(core.formQuestionRequest({ title: "x" }, 0).createItem.item.questionItem.question.required, false);
assert.equal(core.formQuestionRequest({ title: "x", type: "long" }, 0).createItem.item.questionItem.question.textQuestion.paragraph, true);

// Clock picker geometry.
deepEqual(core.clockButtonPosition(0, 12, 40), { x: "50.000%", y: "10.000%" });
deepEqual(core.clockButtonPosition(3, 12, 40), { x: "90.000%", y: "50.000%" });
deepEqual(core.clockButtonPosition(6, 12, 40), { x: "50.000%", y: "90.000%" });

for (const key of Object.keys(api)) {
  assert.ok(covered.has(key), `format-core export without a test: ${key}`);
}
console.log(`format-core tests passed (${Object.keys(api).length} exports covered)`);
