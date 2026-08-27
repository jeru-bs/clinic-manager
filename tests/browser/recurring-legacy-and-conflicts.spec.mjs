import { expect, test } from "@playwright/test";
import { setupUiMocks } from "./helpers/ui-mocks.mjs";

const TS = "2026-01-01T08:00:00.000Z";
const FIXED_NOW = new Date("2026-09-07T12:00:00Z");

// The patients header exactly as it existed before the fixed-treatment range was introduced.
const LEGACY_PATIENT_HEADER = [
  "id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day",
  "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status",
  "default_payment_method", "payment_status", "receipt_status", "drive_folder_id",
  "drive_folder_path", "created_at", "updated_at"
];
const EXTENDED_PATIENT_HEADER = [...LEGACY_PATIENT_HEADER, "fixed_start_date", "fixed_end_date"];

function patientRow(id, name, { day = "", time = "", start = "", end = "" } = {}) {
  return [
    id, name, "", "בית ספר", "רגשי", "300", day, time, "", "", "", "active",
    "cash", "unpaid", "not_needed", `folder-${id}`, "", TS, TS, start, end
  ];
}

// A row stored before the two columns existed simply stops at the legacy width.
function legacyPatientRow(id, name, day, time) {
  return patientRow(id, name, { day, time }).slice(0, LEGACY_PATIENT_HEADER.length);
}

function sessionRow(id, patientId, date, time) {
  return [id, patientId, date, time, "10:50", "קליניקה", "טיפול", "מפגש", "", "event-old", TS, TS, ""];
}

// Ignores the questionnaire templates the app seeds on first load.
function dataAppends(captured) {
  return captured.appends.filter((entry) =>
    ["patients", "sessions", "schedule_exceptions"].includes(entry.sheet)
  );
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

async function captureCalendarEvents(page) {
  const events = [];
  await page.route("https://www.googleapis.com/calendar/v3/**", (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() || {};
      events.push(String(body.start?.dateTime || "").slice(0, 10));
    }
    if (request.method() === "DELETE") events.push("deleted");
    return route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { id: `calendar-event-${events.length}` }
    });
  });
  return events;
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

test("a legacy unbounded fixed treatment keeps appearing in the calendar", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });

  await openApp(page, "/#/calendar");

  // 2026-09-07 and 2026-09-14 are Mondays; neither is inside any stored range.
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
  await expect(page.locator(".calendar-day[data-date='2026-09-14'] .calendar-event")).toContainText(
    "נועם"
  );
  await page.locator(".calendar-day[data-date='2026-09-14']").click();
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
});

test("editing a legacy fixed treatment requires both bounds before saving", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });

  await openPatientDrawer(page, "p1");
  await expect(page.locator(".form-note")).toContainText("טווח תאריכים");
  await submitPatientForm(page);

  await expect(page.locator(".message.error")).toContainText(
    "לטיפול קבוע צריך להגדיר תאריך התחלה ותאריך סיום."
  );
  expect(dataAppends(captured)).toHaveLength(0);
  expect(captured.puts).toHaveLength(0);
});

test("the legacy patients header is extended safely and idempotently", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured, store } = await setupUiMocks(page, {
    headers: { patients: LEGACY_PATIENT_HEADER },
    gridColumns: { patients: LEGACY_PATIENT_HEADER.length },
    seed: { patients: [legacyPatientRow("p1", "נועם", "שני", "10:00")] }
  });

  await openApp(page, "/#/calendar");
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");

  // The grid is widened first, then exactly the two trailing columns are added to the header.
  expect(captured.gridAppends).toEqual([{ sheet: "patients", length: 2 }]);
  expect(captured.headerPuts).toHaveLength(1);
  expect(captured.headerPuts[0].sheet).toBe("patients");
  expect(captured.headerPuts[0].row).toEqual(EXTENDED_PATIENT_HEADER);

  // No stored row was touched, moved or rewritten.
  expect(captured.puts.filter((entry) => entry.sheet === "patients")).toHaveLength(0);
  expect(captured.clears).toHaveLength(0);
  expect(dataAppends(captured)).toHaveLength(0);
  expect(store.patients[0]).toEqual(legacyPatientRow("p1", "נועם", "שני", "10:00"));

  // Reloading against the already-extended header must not write it again.
  await openApp(page, "/#/calendar");
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
  expect(captured.headerPuts).toHaveLength(1);
  expect(captured.gridAppends).toHaveLength(1);
});

test("a genuinely mismatched header is still blocked and reported", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    headers: { patients: ["id", "שם הילד", "address"] },
    seed: { patients: [] }
  });

  await openApp(page, "/#/calendar");

  await expect(page.locator(".message.error").first()).toContainText("מבנה מאגר הנתונים לא תקין");
  expect(captured.headerPuts).toHaveLength(0);
  expect(captured.clears).toHaveLength(0);
});

test("Yom Kippur offers cancel or move only", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [
    { date: "2026-09-21", title: "יום כפור", english: "Yom Kippur", yomtov: true }
  ]);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-14");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  await expect(page.locator(".modal-message")).toContainText("יום כפור");
  await expect(page.locator('.modal-backdrop [data-modal-action="cancel"]')).toBeVisible();
  await expect(page.locator('.modal-backdrop [data-modal-action="move"]')).toBeVisible();
  await expect(page.locator('.modal-backdrop [data-modal-action="keep"]')).toHaveCount(0);
  await expect(page.locator(".modal-actions")).not.toContainText("אל תשנה");
});

test("Tisha B'Av offers cancel or move only", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  // Hebcal files Tisha B'Av under the fasts, but it may not stay in place.
  await routeHolidays(page, [
    { date: "2026-09-21", title: "תשעה באב", english: "Tish'a B'Av", subcat: "fast" }
  ]);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-14");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  await expect(page.locator(".modal-message")).toContainText("תשעה באב");
  await expect(page.locator('.modal-backdrop [data-modal-action="keep"]')).toHaveCount(0);
});

test("Hanukkah and a minor fast also offer keeping the treatment in place", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [
    { date: "2026-09-14", title: "חנוכה", english: "Chanukah: 1 Candle" },
    { date: "2026-09-21", title: "צום גדליה", english: "Tzom Gedaliah", subcat: "fast" }
  ]);
  const calendarDates = await captureCalendarEvents(page);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-07");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  // Hanukkah: the third option is offered and keeps the occurrence untouched.
  await expect(page.locator(".modal-message")).toContainText("חנוכה");
  await expect(page.locator('.modal-backdrop [data-modal-action="keep"]')).toHaveText("אל תשנה");
  await modalAction(page, "keep");

  // Minor fast: the same third option is offered.
  await expect(page.locator(".modal-message")).toContainText("צום גדליה");
  await expect(page.locator('.modal-backdrop [data-modal-action="keep"]')).toBeVisible();
  await modalAction(page, "keep");

  await modalAction(page, "save");
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");

  const sessionDates = captured.appends
    .filter((entry) => entry.sheet === "sessions")
    .map((entry) => entry.row[2])
    .sort();
  expect(sessionDates).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  expect(captured.appends.filter((entry) => entry.sheet === "schedule_exceptions")).toHaveLength(0);
  expect(calendarDates.slice().sort()).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);

  // The decision is persisted, so an unchanged resave neither asks again nor duplicates anything.
  await openPatientDrawer(page, "p1");
  await submitPatientForm(page);
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  expect(captured.appends.filter((entry) => entry.sheet === "sessions")).toHaveLength(3);
  expect(captured.appends.filter((entry) => entry.sheet === "schedule_exceptions")).toHaveLength(0);
  expect(calendarDates).toHaveLength(3);
});

test("deleting an occurrence of a recurring series stops it reappearing", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [
        patientRow("p1", "נועם", { day: "שני", time: "10:00", start: "2026-09-07", end: "2026-09-21" })
      ],
      sessions: [sessionRow("s1", "p1", "2026-09-14", "10:00")]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openApp(page, "/#/patients/p1");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').click();
  await page.locator('[data-action="delete-session"][data-id="s1"]').click();
  await expect(page.locator(".message").first()).toContainText("המפגש נמחק");

  const exceptions = captured.appends.filter((entry) => entry.sheet === "schedule_exceptions");
  expect(exceptions).toHaveLength(1);
  expect(exceptions[0].row[1]).toBe("p1");
  expect(exceptions[0].row[2]).toBe("cancel");
  expect(exceptions[0].row[3]).toBe("2026-09-14");
  expect(captured.clears.some((entry) => entry.sheet === "sessions")).toBe(true);

  // The virtual projection must not bring the deleted date back.
  await openApp(page, "/#/calendar");
  await page.locator(".calendar-day[data-date='2026-09-14']").click();
  await expect(page.locator(".day-agenda-row")).toHaveCount(0);
  await expect(page.locator(".calendar-day[data-date='2026-09-14'] .calendar-event")).toHaveCount(0);
  // The rest of the series is untouched.
  await page.locator(".calendar-day[data-date='2026-09-21']").click();
  await expect(page.locator(".day-agenda-row").first()).toContainText("נועם");
});

test("deleting a one-time session writes no cancellation exception", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      sessions: [sessionRow("s1", "p1", "2026-09-09", "10:00")]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openApp(page, "/#/patients/p1");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').click();
  await page.locator('[data-action="delete-session"][data-id="s1"]').click();
  await expect(page.locator(".message").first()).toContainText("המפגש נמחק");

  expect(captured.appends.filter((entry) => entry.sheet === "schedule_exceptions")).toHaveLength(0);
  expect(captured.clears.some((entry) => entry.sheet === "sessions")).toBe(true);
});

test("abandoning a keepable conflict still performs zero writes", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [
    { date: "2026-09-14", title: "חנוכה", english: "Chanukah: 1 Candle" }
  ]);
  const calendarDates = await captureCalendarEvents(page);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-07");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  await expect(page.locator('.modal-backdrop [data-modal-action="keep"]')).toBeVisible();
  await modalAction(page, "abandon");

  await expect(page.locator(".message").first()).toContainText("השמירה בוטלה ולא בוצע שום שינוי.");
  expect(dataAppends(captured)).toHaveLength(0);
  expect(captured.puts).toHaveLength(0);
  expect(captured.clears).toHaveLength(0);
  expect(calendarDates).toHaveLength(0);
});
