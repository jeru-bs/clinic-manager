import { expect, test } from "@playwright/test";
import { setupUiMocks } from "./helpers/ui-mocks.mjs";

// Hebrew punctuation is built from code points so the source stays free of the
// character the project static check treats as a mojibake sentinel.
const GERSHAYIM = String.fromCharCode(0x05f4);
const ELUL_25 = `כ${GERSHAYIM}ה באלול תשפ${GERSHAYIM}ו`;
const TISHREI_17 = `י${GERSHAYIM}ז בתשרי תשפ${GERSHAYIM}ז`;

const TS = "2026-01-01T08:00:00.000Z";
const FIXED_NOW = new Date("2026-09-07T12:00:00Z");

function isMobile() {
  return test.info().project.name.includes("mobile");
}

function patientRow(id, name, { day = "", time = "", start = "", end = "" } = {}) {
  return [
    id, name, "", "בית ספר", "רגשי", "300", day, time, "", "", "", "active",
    "cash", "unpaid", "not_needed", `folder-${id}`, "", TS, TS, start, end
  ];
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
          title: holiday.title,
          yomtov: true
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

test("every visible calendar day cell carries its Hebrew date", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, { seed: { patients: [patientRow("p1", "נועם")] } });

  await openApp(page, "/#/calendar");

  const cells = page.locator(".calendar-day");
  const hebrewCells = page.locator(".calendar-day .day-hebrew");
  const cellCount = await cells.count();
  expect(cellCount).toBeGreaterThan(27);
  expect(await hebrewCells.count()).toBe(cellCount);

  const labels = await hebrewCells.evaluateAll((nodes) => nodes.map((node) => node.dataset.hebrewDate));
  expect(labels.every((label) => Boolean(label && label.trim()))).toBe(true);

  const selectedDay = page.locator(".calendar-day[data-date='2026-09-07']");
  await expect(selectedDay.locator(".day-hebrew")).toHaveAttribute("data-hebrew-date", ELUL_25);
  await expect(selectedDay).toHaveAttribute("aria-label", new RegExp(ELUL_25));
  await expect(page.locator(".day-panel-hebrew")).toHaveText(ELUL_25);

  // A late-month date must not drift across the local day boundary.
  await expect(page.locator(".calendar-day[data-date='2026-09-28'] .day-hebrew")).toHaveAttribute(
    "data-hebrew-date",
    TISHREI_17
  );

  const monthPart = page.locator(".calendar-day[data-date='2026-09-07'] .day-hebrew-month");
  const numberPart = page.locator(".calendar-day[data-date='2026-09-07'] .day-hebrew-num");
  await expect(numberPart).toBeVisible();
  if (isMobile()) {
    await expect(monthPart).toBeHidden();
  } else {
    await expect(monthPart).toBeVisible();
  }
});

test("a daily treatment row opens the patient card by stored id", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  await setupUiMocks(page, {
    seed: {
      // Both patients share a display name, so only the stored id can resolve the card.
      patients: [patientRow("p1", "נועם"), patientRow("p2", "נועם")],
      sessions: [sessionRow("s1", "p2", "2026-09-07", "10:00")]
    }
  });

  await openApp(page, "/#/calendar");

  const row = page.locator(".day-agenda-row").first();
  await expect(row).toHaveAttribute("data-id", "p2");
  const openButton = row.locator(".day-agenda-open");
  await expect(openButton).toHaveAttribute("data-id", "p2");

  // The inner action stays keyboard reachable.
  await openButton.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/patients\/p2$/);
});

test("a fixed treatment cannot be saved without both bounds", async ({ page }) => {
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

test("an end date before the start date is rejected", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-28");
  await pickDate(page, "#fixed_end_date", "2026-09-07");
  await submitPatientForm(page);

  await expect(page.locator(".message.error")).toContainText(
    "תאריך הסיום של הטיפול הקבוע לא יכול להיות לפני תאריך ההתחלה."
  );
  expect(dataAppends(captured)).toHaveLength(0);
  expect(captured.puts).toHaveLength(0);
});

test("a bounded series creates inclusive occurrences once and stays idempotent on resave", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  const calendarDates = await captureCalendarEvents(page);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-07");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");

  const firstSessions = captured.appends.filter((entry) => entry.sheet === "sessions");
  expect(firstSessions.map((entry) => entry.row[2]).sort()).toEqual([
    "2026-09-07",
    "2026-09-14",
    "2026-09-21"
  ]);
  expect(calendarDates.slice().sort()).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);

  const patientPut = captured.puts.find((entry) => entry.sheet === "patients");
  expect(patientPut.row[19]).toBe("2026-09-07");
  expect(patientPut.row[20]).toBe("2026-09-21");

  // Resaving the very same range must not duplicate a single occurrence.
  await openPatientDrawer(page, "p1");
  await submitPatientForm(page);
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");

  const secondSessions = captured.appends.filter((entry) => entry.sheet === "sessions");
  expect(secondSessions).toHaveLength(3);
  expect(calendarDates).toHaveLength(3);
});

test("holiday conflicts are resolved one by one and only the final set is written", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [
    { date: "2026-09-14", title: "סוכות" },
    { date: "2026-09-21", title: "שמחת תורה" }
  ]);
  const calendarDates = await captureCalendarEvents(page);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-07");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  // First conflict: cancel only that occurrence.
  await expect(page.locator(".modal-message")).toContainText(
    "בתוך הטווח שהוגדר, חלה התנגשות עם סוכות, האם לבטל את המפגש או לשנות את המועד שלו?"
  );
  await modalAction(page, "cancel");

  // Second conflict: move only that occurrence.
  await expect(page.locator(".modal-message")).toContainText("שמחת תורה");
  await modalAction(page, "move");
  await pickDate(page, "#conflictReplacementDate", "2026-09-23");
  await modalAction(page, "apply");

  await modalAction(page, "save");
  await expect(page.locator(".message").first()).toContainText("פרטי המטופל עודכנו");

  const sessionDates = captured.appends
    .filter((entry) => entry.sheet === "sessions")
    .map((entry) => entry.row[2])
    .sort();
  expect(sessionDates).toEqual(["2026-09-07", "2026-09-23"]);

  const exceptions = captured.appends.filter((entry) => entry.sheet === "schedule_exceptions");
  expect(exceptions.map((entry) => entry.row[3]).sort()).toEqual(["2026-09-14", "2026-09-21"]);
  expect(exceptions.every((entry) => entry.row[2] === "cancel")).toBe(true);

  // Google Calendar receives the resolved occurrences only.
  expect(calendarDates.slice().sort()).toEqual(["2026-09-07", "2026-09-23"]);
});

test("abandoning the conflict flow performs zero writes", async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const { captured } = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", { day: "שני", time: "10:00" })] }
  });
  await routeHolidays(page, [{ date: "2026-09-14", title: "סוכות" }]);
  const calendarDates = await captureCalendarEvents(page);

  await openPatientDrawer(page, "p1");
  await pickDate(page, "#fixed_start_date", "2026-09-07");
  await pickDate(page, "#fixed_end_date", "2026-09-21");
  await submitPatientForm(page);

  await expect(page.locator(".modal-message")).toContainText("סוכות");
  await modalAction(page, "abandon");

  await expect(page.locator(".message").first()).toContainText("השמירה בוטלה ולא בוצע שום שינוי.");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  expect(dataAppends(captured)).toHaveLength(0);
  expect(captured.puts).toHaveLength(0);
  expect(captured.clears).toHaveLength(0);
  expect(calendarDates).toHaveLength(0);
});
