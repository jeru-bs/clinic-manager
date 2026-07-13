import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../docs/workflow-core.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const core = context.globalThis.CLINIC_WORKFLOW_CORE;

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

console.log("Workflow tests: audit/undo, reminders, Google failures, backup validation and restore rollback: ok");
