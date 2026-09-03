import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

// Monday 7.9.2026: the surrounding week runs Sunday 6.9 to Saturday 12.9.
const FIXED_NOW = new Date("2026-09-07T12:00:00Z");
const TS = "2026-01-01T08:00:00.000Z";

function isMobile() {
  return test.info().project.name.includes("mobile");
}

function sessionRow(id, patientId, date, start, end, type = "טיפול") {
  return [id, patientId, date, start, end, "קליניקה", type, "מפגש", "", "event-1", TS, TS, "", "", "scheduled"];
}

const SEED = {
  patients: [patientRow("p1", "נועם כהן", "300"), patientRow("p2", "דנה לוי", "300")],
  sessions: [
    sessionRow("s1", "p1", "2026-09-08", "10:00", "10:50"),
    sessionRow("s2", "p2", "2026-09-08", "10:30", "11:20", "אבחון"),
    sessionRow("s3", "p1", "2026-09-10", "16:00", "16:50")
  ]
};

async function openCalendar(page, options = {}) {
  await page.clock.setFixedTime(FIXED_NOW);
  const mocks = await setupUiMocks(page, { seed: SEED, calendarView: null, ...options });
  await page.goto("/#/calendar");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".calendar-view-switch")).toBeVisible();
  return mocks;
}

function activeView(page) {
  return page.locator(".calendar-view-button.active");
}

test("the view switcher defaults per device and remembers the chosen view", async ({ page }) => {
  await openCalendar(page);

  if (isMobile()) {
    await expect(activeView(page)).toHaveText("יום");
    await expect(page.locator(".calendar-time-grid.is-day")).toBeVisible();
  } else {
    await expect(activeView(page)).toHaveText("חודש");
    await expect(page.locator(".calendar-grid")).toBeVisible();
  }

  await page.locator('[data-action="calendar-view"][data-view="week"]').click();
  await expect(activeView(page)).toHaveText("שבוע");
  await expect(page.locator(".calendar-time-grid.is-week")).toBeVisible();
  await expect(page.locator('[data-action="calendar-view"][data-view="week"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("clinic-manager-calendar-view"))).toBe("week");

  // The route never changes: reloading and going back keep the week view and stay on the calendar.
  expect(page.url()).toContain("#/calendar");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(activeView(page)).toHaveText("שבוע");
  await expect(page.locator(".calendar-time-grid.is-week")).toBeVisible();

  await page.locator('[data-action="calendar-view"][data-view="day"]').click();
  await expect(activeView(page)).toHaveText("יום");
  await expect(page.locator(".calendar-time-grid.is-day")).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.locator(".calendar-view-switch")).toBeVisible();
  expect(page.url()).toContain("#/calendar");
});

test("the week view places seeded sessions in the right day column and hour", async ({ page }) => {
  await openCalendar(page, { calendarView: "week" });
  await expect(page.locator(".calendar-time-grid.is-week")).toBeVisible();

  // Sunday first, Saturday last; the hour gutter starts at the default 07:00 working hours.
  const columns = page.locator(".calendar-time-column");
  await expect(columns).toHaveCount(7);
  await expect(columns.first()).toHaveAttribute("data-calendar-column", "2026-09-06");
  await expect(columns.last()).toHaveAttribute("data-calendar-column", "2026-09-12");
  await expect(page.locator(".calendar-time-weekday").first()).toHaveText("ראשון");
  await expect(page.locator(".calendar-time-weekday").last()).toHaveText("שבת");
  await expect(page.locator(".calendar-time-hour").first()).toHaveText("07:00");
  await expect(page.locator(".calendar-time-hour")).toHaveCount(14);

  const tuesday = page.locator('[data-calendar-column="2026-09-08"]');
  const block = tuesday.locator('.calendar-block[data-session-block="s1"]');
  await expect(block).toBeVisible();
  await expect(block).toHaveAttribute("data-slot-top", "180");
  await expect(block).toHaveAttribute("data-slot-length", "50");
  await expect(block).toHaveAttribute("data-slot-columns", "2");
  await expect(tuesday.locator('.calendar-block[data-session-block="s2"]')).toHaveAttribute("data-slot-column", "1");
  await expect(page.locator('[data-calendar-column="2026-09-10"] .calendar-block')).toHaveCount(1);
  await expect(page.locator('[data-calendar-column="2026-09-06"] .calendar-block')).toHaveCount(0);

  // 10:00 sits three hours below the 07:00 grid start, so the block top is 3 x hour height.
  const geometry = await block.evaluate((node) => {
    const column = node.closest(".calendar-time-column");
    const hourHeight = column.querySelector(".calendar-time-slot").getBoundingClientRect().height;
    return { top: node.getBoundingClientRect().top - column.getBoundingClientRect().top, hourHeight };
  });
  expect(Math.abs(geometry.top - geometry.hourHeight * 3)).toBeLessThanOrEqual(2);
  expect(geometry.hourHeight).toBeGreaterThan(30);

  // Distinct session types get distinct colours; a block opens the patient card.
  const s1Tone = await block.evaluate((node) => [...node.classList].find((name) => name.startsWith("tone-")));
  const s2Tone = await tuesday
    .locator('.calendar-block[data-session-block="s2"]')
    .evaluate((node) => [...node.classList].find((name) => name.startsWith("tone-")));
  expect(s1Tone).not.toBe(s2Tone);
  await block.click();
  await expect(page).toHaveURL(/#\/patients\/p1$/);
});

test("the day view shows a single column and the navigation buttons move every view", async ({ page }) => {
  await openCalendar(page, { calendarView: "day" });
  const grid = page.locator(".calendar-time-grid.is-day");
  await expect(grid).toBeVisible();
  await expect(page.locator(".calendar-time-column")).toHaveCount(1);
  await expect(page.locator(".calendar-time-column")).toHaveAttribute("data-calendar-column", "2026-09-07");
  await expect(page.locator(".calendar-panel .panel-head h2")).toContainText("יום שני");

  await page.getByRole("button", { name: "הבא" }).click();
  await expect(page.locator(".calendar-time-column")).toHaveAttribute("data-calendar-column", "2026-09-08");
  await expect(page.locator('.calendar-block[data-session-block="s1"]')).toBeVisible();
  await page.getByRole("button", { name: "הקודם" }).click();
  await page.getByRole("button", { name: "הקודם" }).click();
  await expect(page.locator(".calendar-time-column")).toHaveAttribute("data-calendar-column", "2026-09-06");
  await page.getByRole("button", { name: "היום" }).click();
  await expect(page.locator(".calendar-time-column")).toHaveAttribute("data-calendar-column", "2026-09-07");

  await page.locator('[data-action="calendar-view"][data-view="week"]').click();
  await page.getByRole("button", { name: "הבא" }).click();
  await expect(page.locator(".calendar-time-column").first()).toHaveAttribute("data-calendar-column", "2026-09-13");
  await expect(page.locator(".calendar-panel .panel-head h2")).toContainText("13.9.2026");
  await page.getByRole("button", { name: "היום" }).click();
  await expect(page.locator(".calendar-time-column").first()).toHaveAttribute("data-calendar-column", "2026-09-06");

  await page.locator('[data-action="calendar-view"][data-view="month"]').click();
  await page.getByRole("button", { name: "הבא" }).click();
  await expect(page.locator(".calendar-day[data-date='2026-10-15']")).toBeVisible();
});

test("an empty slot starts a new session with the date and time already filled", async ({ page }) => {
  await openCalendar(page, { calendarView: "week" });
  await page.locator('.calendar-time-slot[data-date="2026-09-09"][data-time="11:00"]').click();

  await expect(page).toHaveURL(/#\/patients$/);
  await expect(page.locator("[data-app-message]")).toContainText("9.9.2026");
  await expect(page.locator("[data-app-message]")).toContainText("11:00");

  await page.locator('[data-action="open-profile"][data-id="p1"]').first().click();
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await expect(page.locator("[data-pending-slot]")).toContainText("9.9.2026");
  await expect(page.locator("#session_date")).toHaveValue("2026-09-09");
  await expect(page.locator("#start_time")).toHaveValue("11:00");
  await expect(page.locator("#end_time")).toHaveValue("11:50");
});

test("the week and day grids never scroll sideways on a 390px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCalendar(page, { calendarView: "week" });
  await expect(page.locator(".calendar-time-grid.is-week")).toBeVisible();
  await expect(page.locator(".calendar-time-column")).toHaveCount(7);

  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  await expect(page.locator('.calendar-block[data-session-block="s1"]')).toBeVisible();

  await page.locator('[data-action="calendar-view"][data-view="day"]').click();
  await expect(page.locator(".calendar-time-grid.is-day")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);
});
