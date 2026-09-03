import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

// A Monday; the seeded patient's recurring slot is Monday 10:00, so tests schedule at 11:00.
const FIXED_NOW = new Date("2026-09-07T12:00:00Z");
const TS = "2026-01-01T08:00:00.000Z";
const SESSION_COLUMNS = 15;
const PATIENT_COLUMNS = 21;

function blankRow(columns) {
  return Array.from({ length: columns }, () => "");
}

function sessionRow(id, patientId, date) {
  return [id, patientId, date, "10:00", "10:45", "קליניקה", "טיפול", "סיכום", "", `event-${id}`, TS, TS, "", "", "completed"];
}

function auditRow(index, { undoable = "no", mutations = "[]" } = {}) {
  const minute = String(index % 60).padStart(2, "0");
  const hour = String(Math.floor(index / 60) % 24).padStart(2, "0");
  return [`a${index}`, "update", "task", `t${index}`, `פעולה ${index}`, "azaidman1@gmail.com", mutations, undoable, "", `2026-08-01T${hour}:${minute}:00.000Z`];
}

function appendsFor(captured, sheet) {
  return captured.appends.filter((entry) => entry.sheet === sheet);
}

function putsFor(captured, sheet) {
  return captured.puts.filter((entry) => entry.sheet === sheet);
}

function calendarPosts(captured) {
  return captured.calendar.filter((entry) => entry.method === "POST" && entry.url.includes("/events"));
}

async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

async function setValue(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = v;
  }, value);
}

async function scheduleSession(page) {
  await openApp(page, "/#/patients/p1");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').click();
  await setValue(page, "#start_time", "11:00");
  await setValue(page, "#end_time", "11:45");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
}

// Settings keeps every category in the DOM but hidden; reveal the one that holds `selector`.
async function openSettingsSectionWith(page, selector) {
  await openApp(page, "/#/settings");
  const category = await page.locator(`[data-settings-category]:has(${selector})`).getAttribute("data-settings-category");
  await page.locator(`[data-action="settings-category"][data-category="${category}"]`).click();
  await expect(page.locator(selector).first()).toBeVisible();
}

function acceptDialogs(page) {
  page.on("dialog", (dialog) => dialog.accept());
}

test("a session row is written before its calendar event and a failed event is retried from the sync queue", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")] },
    calendarFailures: [{ method: "POST", status: 503, times: 1 }]
  });

  await scheduleSession(page);
  await expect(page.locator("[data-app-message]")).toContainText("המפגש נשמר במערכת");

  // The sheet row exists even though the first calendar call failed.
  expect(appendsFor(captured, "sessions")).toHaveLength(1);
  expect(captured.calendarFailures).toHaveLength(1);
  const sessionAppend = captured.appends.findIndex((entry) => entry.sheet === "sessions");
  expect(sessionAppend).toBeGreaterThanOrEqual(0);

  // The queue retries in the background and links the event id back onto the row.
  await expect.poll(() => calendarPosts(captured).length).toBe(2);
  await expect.poll(() => putsFor(captured, "sessions").at(-1)?.row[9]).toBe("calendar-event-1");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("clinic-manager-sync-queue-v1") || "[]")).not.toContain("calendar_upsert");
});

test("a rate-limited Sheets call is retried and the save succeeds", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")] },
    sheetFailures: [
      {
        match: "sessions!A:O:append",
        status: 429,
        times: 1,
        headers: { "Retry-After": "0", "Access-Control-Expose-Headers": "Retry-After" }
      }
    ]
  });

  await scheduleSession(page);
  await expect(page.locator("[data-app-message]")).toContainText("המפגש נשמר במערכת");
  await expect(page.locator(".message.error")).toHaveCount(0);

  expect(captured.sheetFailures).toHaveLength(1);
  expect(captured.sheetFailures[0].status).toBe(429);
  expect(appendsFor(captured, "sessions")).toHaveLength(1);
});

test("startup reads all sheets with one batchGet and keeps row numbers for later updates", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")], sessions: [sessionRow("s1", "p1", "2026-09-03")] }
  });

  await openApp(page, "/#/patients/p1");
  const dataReads = captured.batchGets.filter((ranges) => ranges.some((range) => range.startsWith("sessions!A2")));
  expect(dataReads).toHaveLength(1);
  expect(dataReads[0]).toHaveLength(17);

  // A record loaded through batchGet still updates its own row.
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').click();
  await page.locator('[data-action="edit-session"][data-id="s1"]').click();
  await page.locator("#summary").fill("סיכום מעודכן");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  await expect.poll(() => putsFor(captured, "sessions").at(-1)?.range).toBe("sessions!A2:O2");
});

test("an audit log beyond 400 rows is pruned bottom-up and older entries stop being undoable", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const undoableMutations = JSON.stringify([{ table: "tasks", rowNumber: "2", before: null, after: { id: "t1" } }]);
  const auditRows = Array.from({ length: 405 }, (_, index) =>
    auditRow(index, index === 404 ? { undoable: "yes", mutations: undoableMutations } : {})
  );
  const { captured, store } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")], audit_log: auditRows }
  });

  await openApp(page, "/#/settings");

  // The five oldest rows (sheet rows 2-6) go in one contiguous, bottom-up range.
  expect(captured.rowDeletes).toEqual([{ sheet: "audit_log", dimension: "ROWS", startIndex: 1, endIndex: 6 }]);
  expect(store.audit_log).toHaveLength(400);
  expect(store.audit_log[0][0]).toBe("a5");

  // Row numbers moved, so the surviving entries are no longer offered for undo.
  const auditColumnPut = captured.columnPuts.find((entry) => entry.sheet === "audit_log");
  expect(auditColumnPut).toBeTruthy();
  expect(auditColumnPut.values.includes("yes")).toBe(false);
  await expect(page.locator('[data-action="undo-last-action"]')).toHaveCount(0);
});

test("twenty or more blank rows are compacted automatically on load", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured, store } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [...Array.from({ length: 20 }, () => blankRow(SESSION_COLUMNS)), sessionRow("s1", "p1", "2026-09-03")]
    }
  });

  await openApp(page, "/#/patients/p1");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').click();
  await expect(page.locator('[data-action="edit-session"][data-id="s1"]')).toBeVisible();

  expect(captured.rowDeletes).toEqual([{ sheet: "sessions", dimension: "ROWS", startIndex: 1, endIndex: 21 }]);
  expect(store.sessions).toHaveLength(1);
  expect(store.sessions[0][0]).toBe("s1");
});

test("manual sheet compaction from Settings removes blank rows from every sheet and reports the count", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  acceptDialogs(page);
  const { captured, store } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300"), blankRow(PATIENT_COLUMNS), blankRow(PATIENT_COLUMNS)],
      sessions: [sessionRow("s1", "p1", "2026-09-03"), blankRow(SESSION_COLUMNS)]
    }
  });

  await openSettingsSectionWith(page, '[data-action="compact-sheets"]');
  // Under the automatic threshold nothing was removed at load time.
  expect(captured.rowDeletes).toHaveLength(0);

  await page.locator('[data-action="compact-sheets"]').click();
  await expect(page.locator("[data-app-message]")).toContainText("הדחיסה הושלמה: הוסרו 3 שורות ריקות");
  await expect(page.locator("[data-sheet-compaction]")).toContainText("הוסרו 3 שורות ריקות");
  await expect(page.locator("[data-sheet-compaction]")).toContainText("patients: 2");

  expect(captured.rowDeletes).toEqual(
    expect.arrayContaining([
      { sheet: "patients", dimension: "ROWS", startIndex: 2, endIndex: 4 },
      { sheet: "sessions", dimension: "ROWS", startIndex: 2, endIndex: 3 }
    ])
  );
  expect(store.patients).toHaveLength(1);
  expect(store.sessions).toHaveLength(1);
  expect(appendsFor(captured, "audit_log").some((entry) => entry.row[1] === "compact")).toBe(true);
});

test("a new patient with an existing active patient's name is blocked with a choice", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300"), ["p2", "דנה", "", "", "", "300", "", "", "", "", "", "archived", "cash", "unpaid", "not_needed", "folder-p2", "", TS, TS, "", ""]] }
  });

  await openApp(page, "/#/patients");
  await page.locator('[data-action="open-patient-drawer"]:not([data-id])').first().click();
  await expect(page.locator("#patientDrawer")).toBeVisible();
  await page.locator("#child_name").fill("  נועם ");
  await page.locator("#patientDrawer button[type=submit]").click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toContainText("מטופל בשם זהה כבר קיים");
  await modal.locator('[data-modal-action="cancel"]').click();
  await expect(page.locator("[data-app-message]")).toContainText("השמירה בוטלה ולא בוצע שום שינוי.");
  expect(appendsFor(captured, "patients")).toHaveLength(0);

  // Cancelling closed the drawer; "save anyway" on a fresh attempt creates the second card.
  await page.locator('[data-action="open-patient-drawer"]:not([data-id])').first().click();
  await expect(page.locator("#patientDrawer")).toBeVisible();
  await page.locator("#child_name").fill("  נועם ");
  await page.locator("#patientDrawer button[type=submit]").click();
  await modal.locator('[data-modal-action="save"]').click();
  await expect.poll(() => appendsFor(captured, "patients").length).toBe(1);
  expect(appendsFor(captured, "patients")[0].row[1].trim()).toBe("נועם");

  // An archived namesake is not a duplicate.
  await openApp(page, "/#/patients");
  await page.locator('[data-action="open-patient-drawer"]:not([data-id])').first().click();
  await page.locator("#child_name").fill("דנה");
  await page.locator("#patientDrawer button[type=submit]").click();
  await expect.poll(() => appendsFor(captured, "patients").length).toBe(2);
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
});

test("the duplicate dialog can open the existing card instead of saving", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, { seed: { patients: [patientRow("p1", "נועם", "300")] } });

  await openApp(page, "/#/patients");
  await page.locator('[data-action="open-patient-drawer"]:not([data-id])').first().click();
  await page.locator("#child_name").fill("נועם");
  await page.locator("#patientDrawer button[type=submit]").click();
  await page.locator('.modal-backdrop [data-modal-action="open"]').click();

  await expect(page).toHaveURL(/#\/patients\/p1$/);
  await expect(page.locator("[data-app-message]")).toContainText("נפתח הכרטיס הקיים של נועם.");
  expect(appendsFor(captured, "patients")).toHaveLength(0);

  // Editing the existing patient never matches itself.
  await page.locator('[data-action="open-patient-drawer"][data-id="p1"]').first().click();
  await page.locator("#patientDrawer button[type=submit]").click();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await expect.poll(() => putsFor(captured, "patients").length).toBeGreaterThan(0);
});

test("undo refuses when the recorded rows no longer hold the same records", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  acceptDialogs(page);
  const mutations = JSON.stringify([
    { table: "sessions", rowNumber: "2", before: { ...sessionObject("s1"), summary: "ישן" }, after: sessionObject("s1") }
  ]);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s9", "p1", "2026-09-03")],
      audit_log: [["a1", "update", "session", "s1", "עדכון מפגש", "azaidman1@gmail.com", mutations, "yes", "", "2026-09-01T10:00:00.000Z"]]
    }
  });

  await openSettingsSectionWith(page, '[data-action="undo-last-action"][data-id="a1"]');
  await page.locator('[data-action="undo-last-action"][data-id="a1"]').click();

  await expect(page.locator(".message.error")).toContainText("לא ניתן לבטל: הנתונים השתנו מאז");
  expect(putsFor(captured, "sessions")).toHaveLength(0);
  expect(putsFor(captured, "audit_log")).toHaveLength(0);
});

test("a failed audit append keeps the action committed and warns that it cannot be undone", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")] },
    sheetFailures: [{ match: "audit_log!A:J:append", status: 400, times: 10 }]
  });

  await scheduleSession(page);
  await expect(page.locator("[data-app-message]")).toContainText("המפגש נשמר במערכת");
  await expect(page.locator("[data-audit-warning]")).toContainText("לא נרשמה ביומן הפעילות");
  expect(appendsFor(captured, "sessions")).toHaveLength(1);
  expect(appendsFor(captured, "audit_log")).toHaveLength(0);
  await expect(page.locator('[data-action="undo-last-action"]')).toHaveCount(0);
});

function sessionObject(id) {
  return {
    id,
    patient_id: "p1",
    session_date: "2026-09-03",
    start_time: "10:00",
    end_time: "10:45",
    location: "קליניקה",
    session_type: "טיפול",
    summary: "סיכום",
    sensitive_notes: "",
    calendar_event_id: `event-${id}`,
    created_at: TS,
    updated_at: TS,
    document_file_id: "",
    next_plan: "",
    status: "completed"
  };
}
