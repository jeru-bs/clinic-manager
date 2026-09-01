import { expect, test } from "@playwright/test";
import { setupUiMocks } from "./helpers/ui-mocks.mjs";

const TS = "2026-01-01T08:00:00.000Z";
// A Monday, so the recurring שני series has occurrences in the visible month.
const FIXED_NOW = new Date("2026-09-07T12:00:00Z");

function patientRow(id, name, { day = "", time = "", start = "", end = "", price = "300", paymentStatus = "unpaid" } = {}) {
  return [
    id, name, "", "בית ספר", "רגשי", price, day, time, "", "", "", "active",
    "cash", paymentStatus, "not_needed", `folder-${id}`, "", TS, TS, start, end
  ];
}

function sessionRow(id, patientId, date, { time = "10:00", end = "10:45", summary = "", type = "טיפול", status = "" } = {}) {
  return [id, patientId, date, time, end, "קליניקה", type, summary, "", `event-${id}`, TS, TS, "", "", status];
}

function chargeRow(id, sessionId, patientId, date, amount) {
  return [id, sessionId, patientId, date, amount, TS, TS];
}

function taskRow(id, patientId, title, dueDate, taskKey) {
  return [id, patientId, title, "", "open", dueDate, "auto", TS, TS, dueDate, taskKey];
}

function paymentRow(id, patientId, amount, paymentStatus, { receipt = "not_needed", paidAt = "2026-09-01" } = {}) {
  return [id, patientId, "", amount, "cash", paymentStatus, receipt, paidAt, "", "", TS, TS];
}

function appendsFor(captured, sheet) {
  return captured.appends.filter((entry) => entry.sheet === sheet);
}

function putsFor(captured, sheet) {
  return captured.puts.filter((entry) => entry.sheet === sheet);
}

async function routeHolidays(page, holidays) {
  await page.route("https://www.hebcal.com/**", (route) =>
    route.fulfill({
      json: {
        items: holidays.map((holiday) => ({
          category: "holiday",
          date: holiday.date,
          hebrew: holiday.title,
          title: holiday.english || holiday.title,
          subcat: holiday.subcat || "major",
          yomtov: holiday.yomtov === true
        }))
      }
    })
  );
}

async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

async function pickDate(page, selector, isoValue) {
  await page.locator(selector).click();
  for (let step = 0; step < 24; step += 1) {
    const popover = page.locator(".picker-popover.date-popover");
    await expect(popover).toBeVisible();
    const option = popover.locator(`[data-picker-date="${isoValue}"]`);
    if (await option.count()) {
      await option.click();
      return;
    }
    await popover.locator("[data-picker-next]").click();
  }
  throw new Error(`date option ${isoValue} was not reachable`);
}

// Readonly picker inputs are filled directly; the form reads their .value on submit.
async function setValue(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = v;
  }, value);
}

async function openPatientDrawer(page, patientId) {
  await openApp(page, `/#/patients/${patientId}`);
  await page.locator(`[data-action="open-patient-drawer"][data-id="${patientId}"]`).first().click();
  await expect(page.locator("#patientDrawer")).toBeVisible();
}

async function submitPatientForm(page) {
  await page.locator("#patientDrawer button[type=submit]").click();
}

async function modalAction(page, value) {
  const button = page.locator(`.modal-backdrop [data-modal-action="${value}"]`);
  await expect(button).toBeVisible();
  await button.click();
}

async function openProfileTab(page, patientId, tab) {
  await openApp(page, `/#/patients/${patientId}`);
  await page.locator(`[data-action="profile-tab"][data-tab="${tab}"]`).click();
}

test("saving into an occupied slot is blocked, names the conflict and suggests free slots", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם"), patientRow("p2", "תמר")],
      sessions: [sessionRow("s1", "p1", "2026-09-07")]
    }
  });

  await openProfileTab(page, "p2", "documentation");
  await setValue(page, "#start_time", "10:15");
  await setValue(page, "#end_time", "11:00");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();

  const error = page.locator(".message.error").first();
  await expect(error).toContainText("תפוס");
  await expect(error).toContainText("נועם");
  await expect(error).toContainText("מועדים פנויים בסמוך");
  expect(appendsFor(captured, "sessions")).toHaveLength(0);

  // A nearby free slot saves normally.
  await setValue(page, "#start_time", "11:00");
  await setValue(page, "#end_time", "11:45");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
  await expect(page.locator(".list-item", { hasText: "לא נכתב סיכום." })).toBeVisible();
  await expect(page.locator(".message.error")).toHaveCount(0);
  expect(appendsFor(captured, "sessions")).toHaveLength(1);
});

test("editing a session never conflicts with itself and closes its documentation task", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-10")],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-10", "doc:s1")]
    }
  });

  await openProfileTab(page, "p1", "documentation");
  await page.locator('[data-action="edit-session"][data-id="s1"]').click();
  await page.locator("#summary").fill("סיכום מפגש מלא");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();

  await expect(page.locator(".list-item", { hasText: "סיכום מפגש מלא" })).toBeVisible();
  await expect(page.locator(".message.error")).toHaveCount(0);
  // Documentation promoted the stored session to completed and created its single charge.
  const sessionPuts = putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s1");
  expect(sessionPuts.at(-1).row[14]).toBe("completed");
  expect(appendsFor(captured, "session_charges")).toHaveLength(1);
  // The keyed automatic documentation task closed instead of accumulating.
  const taskPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(taskPuts.length).toBeGreaterThan(0);
  expect(taskPuts.at(-1).row[4]).toBe("done");
  expect(appendsFor(captured, "tasks")).toHaveLength(0);
});

test("a single occurrence moves to another day without touching the rest of the series", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [
        patientRow("p1", "נועם", { day: "שני", time: "10:00", start: "2026-09-07", end: "2026-09-14" })
      ],
      sessions: [
        sessionRow("s1", "p1", "2026-09-07", { type: "מפגש קבוע" }),
        sessionRow("s2", "p1", "2026-09-14", { type: "מפגש קבוע" })
      ]
    }
  });

  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-14']").click();
  await page.locator('[data-action="reschedule-occurrence"][data-session-id="s2"]').click();
  await setValue(page, "#conflictReplacementDate", "2026-09-16");
  await setValue(page, "#conflictReplacementTime", "12:00");
  await modalAction(page, "apply");

  await expect(page.locator(".message").first()).toContainText("מועד המפגש עודכן");
  // The stored occurrence moved, and a reschedule exception pins the original series slot.
  const sessionPuts = putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s2");
  expect(sessionPuts.at(-1).row[2]).toBe("2026-09-16");
  expect(sessionPuts.at(-1).row[3]).toBe("12:00");
  const exceptions = appendsFor(captured, "schedule_exceptions");
  expect(exceptions).toHaveLength(1);
  expect(exceptions[0].row.slice(1, 4)).toEqual(["p1", "reschedule", "2026-09-14"]);
  expect(exceptions[0].row[8]).toBe("2026-09-16");
  expect(exceptions[0].row[9]).toBe("12:00");

  // The vacated Monday stays empty (no projection returns) while the new date shows the session.
  await page.locator(".calendar-day[data-date='2026-09-14']").click();
  await expect(page.locator(".day-agenda-row")).toHaveCount(0);
  await page.locator(".calendar-day[data-date='2026-09-16']").click();
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
  // The untouched first occurrence is still in place.
  await page.locator(".calendar-day[data-date='2026-09-07']").click();
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
});

test("rescheduling an overdue session clears its stale documentation reminder and recreates it only after the new date passes", async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW });
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-01")],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-01", "doc:s1")]
    }
  });

  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-01']").click();
  await page.locator('[data-action="reschedule-occurrence"][data-session-id="s1"]').click();
  await setValue(page, "#conflictReplacementDate", "2026-09-16");
  await setValue(page, "#conflictReplacementTime", "12:00");
  await modalAction(page, "apply");
  await expect(page.locator(".message").first()).toContainText("מועד המפגש עודכן");

  const staleTaskPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(staleTaskPuts.at(-1).row[4]).toBe("done");
  expect(appendsFor(captured, "tasks")).toHaveLength(0);

  // Once the replacement occurrence itself has passed without documentation, a fresh reminder
  // is created for the new date rather than reviving the stale overdue date.
  await page.clock.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  await page.locator('[data-action="refresh"]').evaluate((button) => button.click());
  await expect
    .poll(() => appendsFor(captured, "tasks").filter((entry) => entry.row[10] === "doc:s1").length)
    .toBe(1);
  const replacementTasks = appendsFor(captured, "tasks").filter(
    (entry) => entry.row[10] === "doc:s1"
  );
  expect(replacementTasks).toHaveLength(1);
  expect(replacementTasks[0].row[5]).toBe("2026-09-16");
  expect(replacementTasks[0].row[3]).toContain("16.9.2026");
});

test("rescheduling an overdue session to another past date updates its documentation reminder in place", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-01")],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-01", "doc:s1")]
    }
  });

  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-01']").click();
  await page.locator('[data-action="reschedule-occurrence"][data-session-id="s1"]').click();
  await setValue(page, "#conflictReplacementDate", "2026-09-03");
  await setValue(page, "#conflictReplacementTime", "12:00");
  await modalAction(page, "apply");
  await expect(page.locator(".message").first()).toContainText("מועד המפגש עודכן");

  const taskPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(taskPuts.at(-1).row[4]).toBe("open");
  expect(taskPuts.at(-1).row[5]).toBe("2026-09-03");
  expect(taskPuts.at(-1).row[3]).toContain("3.9.2026");
  expect(appendsFor(captured, "tasks")).toHaveLength(0);
});

test("a deferred holiday decision creates one reminder task, survives resaves and resolves later", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [{ date: "2026-09-21", title: "חנוכה", english: "Chanukah: 1 Candle" }]);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-14");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  await expect(page.locator(".modal-message")).toContainText("חנוכה");
  await expect(page.locator('.modal-backdrop [data-modal-action="defer"]')).toHaveText("החלטה מאוחר יותר");
  await modalAction(page, "defer");
  await expect(page.locator(".modal-message")).toContainText("ממתינים להחלטה");
  await modalAction(page, "save");
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");

  // Only the non-deferred occurrence materialized; the pending exception keeps 21.9 unconfirmed.
  expect(appendsFor(captured, "sessions").map((entry) => entry.row[2])).toEqual(["2026-09-14"]);
  const exceptions = appendsFor(captured, "schedule_exceptions");
  expect(exceptions).toHaveLength(1);
  expect(exceptions[0].row.slice(1, 4)).toEqual(["p1", "holiday_pending", "2026-09-21"]);
  expect(exceptions[0].row[9]).toBe("10:00");
  // The deferred decision task is due on the treatment date with a reminder 7 days ahead.
  const taskAppends = appendsFor(captured, "tasks");
  const decisionTask = taskAppends.find((entry) => entry.row[10] === "holiday-decision:p1:2026-09-21");
  expect(decisionTask.row[5]).toBe("2026-09-21");
  expect(decisionTask.row[9]).toBe("2026-09-14");
  // The end-of-series follow-up rides the same save.
  const seriesEndTask = taskAppends.find((entry) => entry.row[10] === "series-end:p1");
  expect(seriesEndTask.row[5]).toBe("2026-09-21");

  // An unchanged resave asks nothing again and duplicates nothing.
  const dataSheets = ["sessions", "schedule_exceptions", "tasks"];
  const appendsBefore = dataSheets.map((sheet) => appendsFor(captured, sheet).length);
  await openPatientDrawer(page, "p1");
  await submitPatientForm(page);
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  expect(dataSheets.map((sheet) => appendsFor(captured, sheet).length)).toEqual(appendsBefore);

  // Resolving later reuses the original choices; "keep" materializes the occurrence.
  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-21']").click();
  await page.locator('[data-action="resolve-holiday-decision"][data-patient-id="p1"]').click();
  await expect(page.locator(".modal-message")).toContainText("חנוכה");
  await modalAction(page, "keep");

  await expect(page.locator(".message").first()).toContainText("המפגש נשמר במועד המקורי");
  expect(appendsFor(captured, "sessions").map((entry) => entry.row[2]).sort()).toEqual([
    "2026-09-14",
    "2026-09-21"
  ]);
  // The pending exception is gone and the reminder task auto-closed.
  expect(captured.clears.some((entry) => entry.sheet === "schedule_exceptions")).toBe(true);
  const decisionPuts = putsFor(captured, "tasks").filter(
    (entry) => entry.row[10] === "holiday-decision:p1:2026-09-21"
  );
  expect(decisionPuts.at(-1).row[4]).toBe("done");
});

test("ending a treatment clears only future placeholders and surfaces the open debt", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [
        patientRow("p1", "נועם", { day: "שני", time: "10:00", start: "2026-09-01", end: "2026-12-31" })
      ],
      sessions: [
        sessionRow("s1", "p1", "2026-08-31", { summary: "סיכום קיים", status: "completed" }),
        sessionRow("s2", "p1", "2026-09-14", { type: "מפגש קבוע" })
      ],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-31", "300")]
    }
  });

  await openApp(page, "/#/patients");
  const row = page.locator("tbody tr.row-link", { hasText: "נועם" });
  await row.locator('[data-action="toggle-row-menu"]').click();
  await page.getByRole("menuitem", { name: "ארכוב" }).click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("יתרת חוב");
  await expect(modal).toContainText("300.00");
  await modal.locator('[data-modal-action="archive"]').click();

  await expect(page.locator(".message").first()).toContainText("יתרת חוב");
  await expect(row.getByText("ארכיון", { exact: true })).toBeVisible();
  // Only the future undocumented placeholder (row 3) was cleared; history stays intact.
  const sessionClears = captured.clears.filter((entry) => entry.sheet === "sessions");
  expect(sessionClears).toHaveLength(1);
  expect(sessionClears[0].range).toContain("A3");
  expect(captured.clears.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
  const patientPuts = putsFor(captured, "patients").filter((entry) => entry.row[0] === "p1");
  expect(patientPuts.at(-1).row[11]).toBe("archived");
});

test("outstanding balances agree across dashboard, profile, payments and reports", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: {
      // The stale legacy payment_status says "paid" while a real charge is still open.
      patients: [patientRow("p1", "נועם", { paymentStatus: "paid" })],
      sessions: [sessionRow("s1", "p1", "2026-09-01", { summary: "סיכום", status: "completed" })],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-09-01", "300")]
    }
  });

  await openApp(page, "/");
  const panel = page.locator("article.panel", { hasText: "תשלומים פתוחים" });
  await expect(panel).toContainText("נועם");
  await expect(panel).toContainText("300.00");

  await openApp(page, "/#/patients/p1");
  await expect(page.locator(".summary-fact", { hasText: "יתרת חוב" })).toContainText("300.00");
  // The charge ledger, not the legacy flag, drives the payment pill.
  await expect(page.locator(".summary-title .status-pill").first()).toHaveText("פתוח");

  await openApp(page, "/#/payments");
  await expect(page.locator('[data-payments-total="open"]')).toContainText("300.00");

  await openApp(page, "/#/reports");
  await expect(page.locator(".metric.pink-card").first()).toContainText("300.00");
});

test("payment follow-up and receipt tasks reconcile with status changes without duplicating", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      payments: [paymentRow("pay1", "p1", "300", "pending")],
      tasks: [taskRow("t1", "p1", "מעקב תשלום פתוח", "2026-09-01", "payment-followup:pay1")]
    }
  });

  await openApp(page, "/#/payments");
  await page.locator('[data-action="set-payment-status"][data-id="pay1"][data-status="paid"]').click();
  await expect(page.locator(".message").first()).toBeVisible();

  // Marking as paid closes the keyed follow-up and opens exactly one receipt task.
  const followupPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(followupPuts.at(-1).row[4]).toBe("done");
  const receiptAppends = appendsFor(captured, "tasks").filter(
    (entry) => entry.row[10] === "receipt:pay1"
  );
  expect(receiptAppends).toHaveLength(1);

  await page.locator('[data-action="set-receipt-status"][data-id="pay1"][data-status="issued"]').click();
  await expect(
    page.locator('[data-action="set-receipt-status"][data-id="pay1"]')
  ).toHaveCount(0);

  // Issuing the receipt auto-closes the receipt task; nothing new is appended.
  const receiptPuts = putsFor(captured, "tasks").filter((entry) => entry.row[10] === "receipt:pay1");
  expect(receiptPuts.at(-1).row[4]).toBe("done");
  expect(appendsFor(captured, "tasks")).toHaveLength(1);
});

function exceptionRow(id, patientId, type, date, { movedDate = "", movedTime = "" } = {}) {
  return [id, patientId, type, date, date, "", TS, TS, movedDate, movedTime];
}

async function awaitAppMessage(page, text) {
  await expect(page.locator("[data-app-message]")).toContainText(text);
}

function calendarCalls(captured, method) {
  return captured.calendar.filter(
    (entry) => entry.method === method && entry.url.includes("/events")
  );
}

test("moving a session updates its calendar event in place and cancelling deletes it", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-10")]
    }
  });

  await openProfileTab(page, "p1", "documentation");
  const patchesBefore = calendarCalls(captured, "PATCH").length;
  await page.locator('[data-action="edit-session"][data-id="s1"]').click();
  await setValue(page, "#start_time", "12:00");
  await setValue(page, "#end_time", "12:45");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  await awaitAppMessage(page, "המפגש נשמר במערכת");

  // The move rewrote the existing event in place; no replacement event was created alongside it.
  const movePatches = calendarCalls(captured, "PATCH").slice(patchesBefore);
  expect(movePatches.some((entry) => entry.url.includes("/events/event-s1"))).toBe(true);
  expect(calendarCalls(captured, "POST")).toHaveLength(0);
  expect(calendarCalls(captured, "DELETE")).toHaveLength(0);

  await page.locator('[data-action="edit-session"][data-id="s1"]').click();
  await page.locator("#session_status").selectOption("cancelled");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  // The first save left the same success message on screen, so wait on the write itself.
  await expect
    .poll(() => putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s1").at(-1)?.row[14])
    .toBe("cancelled");

  // Cancelling removed the event from the calendar and detached it from the session row.
  const deletes = calendarCalls(captured, "DELETE");
  expect(deletes).toHaveLength(1);
  expect(deletes[0].url.includes("/events/event-s1")).toBe(true);
  expect(calendarCalls(captured, "POST")).toHaveLength(0);
  const sessionPuts = putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s1");
  expect(sessionPuts.at(-1).row[14]).toBe("cancelled");
  expect(sessionPuts.at(-1).row[9]).toBe("");
});

test("ending a treatment cancels manual future appointments and clears their calendar events", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [
        patientRow("p1", "נועם", { day: "שני", time: "10:00", start: "2026-09-01", end: "2026-12-31" })
      ],
      sessions: [
        sessionRow("s1", "p1", "2026-08-31", { summary: "סיכום קיים", status: "completed" }),
        sessionRow("s2", "p1", "2026-09-14", { type: "מפגש קבוע" }),
        sessionRow("s3", "p1", "2026-09-16")
      ],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-31", "300")],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-16", "doc:s3")]
    }
  });

  await openApp(page, "/#/patients");
  const row = page.locator("tbody tr.row-link", { hasText: "נועם" });
  await row.locator('[data-action="toggle-row-menu"]').click();
  await page.getByRole("menuitem", { name: "ארכוב" }).click();

  const modal = page.locator(".modal-backdrop");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("יבוטלו ויוסרו מהיומן");
  await modal.locator('[data-modal-action="archive"]').click();
  await expect(row.getByText("ארכיון", { exact: true })).toBeVisible();

  // Only the replaceable placeholder row was cleared; the manual appointment stays as history.
  const sessionClears = captured.clears.filter((entry) => entry.sheet === "sessions");
  expect(sessionClears).toHaveLength(1);
  expect(sessionClears[0].range).toContain("A3");
  const manualPuts = putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s3");
  expect(manualPuts.at(-1).row[14]).toBe("cancelled");
  expect(manualPuts.at(-1).row[9]).toBe("");
  // Both future bookings left the calendar; nothing financial was touched.
  const deletedEvents = calendarCalls(captured, "DELETE").map((entry) => entry.url);
  expect(deletedEvents.some((url) => url.includes("event-s2"))).toBe(true);
  expect(deletedEvents.some((url) => url.includes("event-s3"))).toBe(true);
  expect(captured.clears.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
  const docTaskPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(docTaskPuts.at(-1).row[4]).toBe("done");
});

test("an appointment whose time passed without documentation raises one reminder on load", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [
        sessionRow("s1", "p1", "2026-09-01", { type: "מפגש קבוע", summary: "מפגש קבוע לפי הגדרת המטופל." }),
        sessionRow("s2", "p1", "2026-09-02", { status: "no_show" }),
        sessionRow("s3", "p1", "2026-09-03", { summary: "סיכום", status: "completed" }),
        sessionRow("s4", "p1", "2026-09-10")
      ],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-02", "doc:s2")]
    }
  });

  await openApp(page, "/#/tasks");
  // Only the overdue undocumented appointment got a reminder; the placeholder text did not
  // count as documentation, and completed/no-show/future sessions were left alone.
  const docAppends = appendsFor(captured, "tasks");
  expect(docAppends).toHaveLength(1);
  expect(docAppends[0].row[10]).toBe("doc:s1");
  expect(docAppends[0].row[5]).toBe("2026-09-01");
  await expect(page.locator("tbody tr", { hasText: "הסתיים ללא תיעוד" }).first()).toBeVisible();
  // The stale reminder of the no-show session closed automatically.
  const stalePuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(stalePuts.at(-1).row[4]).toBe("done");

  // A second load neither duplicates the reminder nor rewrites it.
  await openApp(page, "/#/tasks");
  expect(appendsFor(captured, "tasks")).toHaveLength(1);
  expect(putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1")).toEqual(stalePuts);
});

test("a deferred holiday slot stays reserved until the decision frees it", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [
        patientRow("p1", "נועם", { day: "שני", time: "10:00", start: "2026-09-14", end: "2026-09-21" }),
        patientRow("p2", "תמר")
      ],
      schedule_exceptions: [exceptionRow("e1", "p1", "holiday_pending", "2026-09-21")]
    }
  });
  await routeHolidays(page, [{ date: "2026-09-21", title: "חנוכה", english: "Chanukah: 1 Candle" }]);

  // While the decision is pending the original time still belongs to the deferred occurrence.
  await openProfileTab(page, "p2", "documentation");
  await setValue(page, "#session_date", "2026-09-21");
  await setValue(page, "#start_time", "10:15");
  await setValue(page, "#end_time", "11:00");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
  const error = page.locator(".message.error").first();
  await expect(error).toContainText("תפוס");
  await expect(error).toContainText("נועם");
  expect(appendsFor(captured, "sessions")).toHaveLength(0);

  // Resolving the decision as a cancellation releases the slot.
  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-21']").click();
  await page.locator('[data-action="resolve-holiday-decision"][data-patient-id="p1"]').click();
  await expect(page.locator(".modal-message")).toContainText("חנוכה");
  await modalAction(page, "cancel");
  await awaitAppMessage(page, "המפגש בוטל לתאריך הזה.");
  const exceptionPuts = putsFor(captured, "schedule_exceptions").filter((entry) => entry.row[0] === "e1");
  expect(exceptionPuts.at(-1).row[2]).toBe("cancel");

  await openProfileTab(page, "p2", "documentation");
  await setValue(page, "#session_date", "2026-09-21");
  await setValue(page, "#start_time", "10:15");
  await setValue(page, "#end_time", "11:00");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
  await awaitAppMessage(page, "המפגש נשמר במערכת");
  const saved = appendsFor(captured, "sessions");
  expect(saved).toHaveLength(1);
  expect(saved[0].row[2]).toBe("2026-09-21");
});

test("marking a passed appointment as no-show never creates a charge", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-01")],
      tasks: [taskRow("t1", "p1", "השלמת תיעוד מפגש", "2026-09-01", "doc:s1")]
    }
  });

  await openProfileTab(page, "p1", "documentation");
  await page.locator('[data-action="edit-session"][data-id="s1"]').click();
  await page.locator("#session_status").selectOption("no_show");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  await awaitAppMessage(page, "המפגש נשמר במערכת");

  // Neither the passage of time nor the no-show status produced a charge.
  expect(appendsFor(captured, "session_charges")).toHaveLength(0);
  const sessionPuts = putsFor(captured, "sessions").filter((entry) => entry.row[0] === "s1");
  expect(sessionPuts.at(-1).row[14]).toBe("no_show");
  // The documentation reminder closed: a no-show has nothing left to document.
  const taskPuts = putsFor(captured, "tasks").filter((entry) => entry.row[0] === "t1");
  expect(taskPuts.at(-1).row[4]).toBe("done");
});

test("a patient without charges never shows a legacy debt state", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם"), patientRow("p2", "תמר")],
      sessions: [sessionRow("s2", "p2", "2026-09-01", { summary: "סיכום", status: "completed" })],
      session_charges: [chargeRow("c1", "s2", "p2", "2026-09-01", "300")]
    }
  });

  await openApp(page, "/#/patients");
  const legacyPill = page
    .locator("tbody tr", { hasText: "נועם" })
    .locator('td[data-label="תשלום"] .status-pill');
  await expect(legacyPill).toHaveText("ללא חיובים");
  await expect(legacyPill).not.toHaveClass(/tone-danger/);
  const chargedPill = page
    .locator("tbody tr", { hasText: "תמר" })
    .locator('td[data-label="תשלום"] .status-pill');
  await expect(chargedPill).toHaveText("פתוח");
  await expect(chargedPill).toHaveClass(/tone-danger/);

  await openApp(page, "/#/patients/p1");
  await expect(page.locator(".summary-title .status-pill").first()).toHaveText("ללא חיובים");
});
