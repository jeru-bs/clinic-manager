import { expect, test } from "@playwright/test";
import { patientRow, sessionRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

// שומר על נוכחות הצבע המאושרת: אם מישהו יחזיר את הממשק לגווני אפור, הבדיקות ייפלו.
const COLOR = {
  primary: "rgb(65, 89, 199)",
  primaryStrong: "rgb(48, 70, 173)",
  primarySoft: "rgb(228, 232, 248)",
  surface: "rgb(255, 255, 255)",
  white: "rgb(255, 255, 255)",
  success: "rgb(8, 127, 117)",
  successSoft: "rgb(224, 240, 238)",
  successText: "rgb(5, 97, 90)",
  warningSoft: "rgb(253, 241, 220)",
  warningText: "rgb(107, 70, 0)",
  dangerSoft: "rgb(252, 231, 238)",
  dangerText: "rgb(168, 26, 75)",
  yellow: "rgb(255, 192, 77)",
  pink: "rgb(197, 29, 93)",
  purple: "rgb(114, 84, 199)"
};

function paymentRow(id, patientId, amount, paymentStatus, receiptStatus) {
  return [
    id,
    patientId,
    "",
    amount,
    "cash",
    paymentStatus,
    receiptStatus,
    "2026-08-03",
    "",
    "",
    "2026-08-03T09:00:00.000Z",
    "2026-08-03T09:00:00.000Z"
  ];
}

function taskRow(id, patientId, title, status) {
  return [
    id,
    patientId,
    title,
    "",
    status,
    "2026-08-10",
    "manual",
    "2026-08-01T09:00:00.000Z",
    "2026-08-01T09:00:00.000Z",
    ""
  ];
}

const SEED = {
  patients: [patientRow("p1", "נועם", "300"), patientRow("p2", "יעל", "250")],
  sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
  payments: [
    paymentRow("pay1", "p1", "300", "paid", "needed"),
    paymentRow("pay2", "p2", "250", "unpaid", "not_needed")
  ],
  tasks: [taskRow("t1", "p1", "מעקב", "open"), taskRow("t2", "p2", "סיכום", "done")]
};

async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

function isMobile() {
  return test.info().project.name.includes("mobile");
}

function styleOf(locator, property) {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

function pseudoStyleOf(locator, pseudo, property) {
  return locator.evaluate(
    (element, args) => getComputedStyle(element, args.pseudo).getPropertyValue(args.name),
    { pseudo, name: property }
  );
}

test("primary actions and the active global navigation carry the approved primary colour", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const primaryAction = page.locator(".header .button").first();
  await expect(primaryAction).toBeVisible();
  expect(await styleOf(primaryAction, "background-color")).toBe(COLOR.primary);
  expect(await styleOf(primaryAction, "color")).toBe(COLOR.white);

  const activeLink = page.locator(".side-link.active");
  await expect(activeLink).toHaveCount(1);
  expect(await pseudoStyleOf(activeLink, "::before", "background-color")).toBe(COLOR.primary);
  if (isMobile()) {
    expect(await pseudoStyleOf(activeLink, "::before", "height")).toBe("4px");
  } else {
    expect(await styleOf(activeLink, "background-color")).toBe(COLOR.surface);
    expect(await pseudoStyleOf(activeLink, "::before", "width")).toBe("5px");
  }
});

test("context spine counts expose their functional colour as a filled marker", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/dashboard");

  const counts = page.locator(".spine-count");
  await expect(counts).toHaveCount(4);
  const tones = [COLOR.primary, COLOR.success, COLOR.yellow, COLOR.pink];
  for (const [index, tone] of tones.entries()) {
    const count = counts.nth(index);
    expect(await styleOf(count.locator(".spine-count-glyph"), "color")).toBe(tone);
    if (!isMobile()) {
      expect(await pseudoStyleOf(count, "::after", "background-color")).toBe(tone);
      expect(await pseudoStyleOf(count, "::after", "width")).toBe("5px");
    }
  }
});

test("the selected settings category is a tinted block, not a hairline", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/settings");

  const active = page.locator(".spine-nav-item.active").first();
  await expect(active).toBeVisible();
  expect(await styleOf(active, "background-color")).toBe(COLOR.primarySoft);
  expect(await styleOf(active, "color")).toBe(COLOR.primaryStrong);
  if (!isMobile()) {
    expect(await pseudoStyleOf(active, "::before", "background-color")).toBe(COLOR.primary);
    expect(await pseudoStyleOf(active, "::before", "width")).toBe("5px");
  }
});

test("the patient record navigation keeps nine functional colours and a selected blue section", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients/p1");

  const tabs = page.locator(".spine .profile-tab");
  await expect(tabs).toHaveCount(9);
  const glyphTones = [
    COLOR.primary,
    COLOR.primary,
    COLOR.success,
    COLOR.yellow,
    COLOR.purple,
    COLOR.success,
    COLOR.pink,
    COLOR.purple,
    COLOR.yellow
  ];
  for (const [index, tone] of glyphTones.entries()) {
    expect(await styleOf(tabs.nth(index).locator(".profile-tab-glyph"), "color")).toBe(tone);
  }

  const active = page.locator(".spine .profile-tab.active");
  await expect(active).toHaveCount(1);
  expect(await styleOf(active, "background-color")).toBe(COLOR.primarySoft);
  expect(await styleOf(active, "color")).toBe(COLOR.primaryStrong);
  if (!isMobile()) {
    expect(await pseudoStyleOf(active, "::before", "background-color")).toBe(COLOR.primary);
  }
});

test("success, pending and attention statuses stay visibly tinted", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/tasks");

  const done = page.locator(".status-pill.tone-success").first();
  await expect(done).toBeVisible();
  expect(await styleOf(done, "background-color")).toBe(COLOR.successSoft);
  expect(await styleOf(done, "color")).toBe(COLOR.successText);
  expect(await pseudoStyleOf(done, "::before", "background-color")).toBe(COLOR.success);

  const pending = page.locator(".status-pill.tone-warning").first();
  await expect(pending).toBeVisible();
  expect(await styleOf(pending, "background-color")).toBe(COLOR.warningSoft);
  expect(await styleOf(pending, "color")).toBe(COLOR.warningText);

  await openApp(page, "/#/patients");
  const attention = page.locator(".status-pill.tone-danger").first();
  await expect(attention).toBeVisible();
  expect(await styleOf(attention, "background-color")).toBe(COLOR.dangerSoft);
  expect(await styleOf(attention, "color")).toBe(COLOR.dangerText);
});

test("payments totals and the active payment view read as coloured states", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/payments");

  expect(await styleOf(page.locator('[data-payments-total="paid"] span'), "color")).toBe(COLOR.successText);
  expect(await styleOf(page.locator('[data-payments-total="open"] span'), "color")).toBe(COLOR.dangerText);
  expect(await styleOf(page.locator('[data-payments-total="receipts"] span'), "color")).toBe(COLOR.warningText);

  const activeView = page.locator(".spine-nav.boxed .spine-nav-item.active");
  await expect(activeView).toHaveCount(1);
  expect(await styleOf(activeView, "background-color")).toBe(COLOR.primarySoft);
  expect(await styleOf(activeView, "border-top-color")).toBe(COLOR.primary);
  expect(await styleOf(activeView, "color")).toBe(COLOR.primaryStrong);
  expect(await styleOf(activeView.locator("small"), "background-color")).toBe(COLOR.primary);
  expect(await styleOf(activeView.locator("small"), "color")).toBe(COLOR.white);

  await page.locator('[data-action="set-payments-view"][data-view="receipts-pending"]').click();
  const switched = page.locator('.spine-nav.boxed .spine-nav-item.active[data-view="receipts-pending"]');
  await expect(switched).toHaveCount(1);
  expect(await styleOf(switched, "background-color")).toBe(COLOR.primarySoft);
});

test("hovering a patient row selects it in the approved primary tint", async ({ page }) => {
  test.skip(isMobile(), "hover אינו רלוונטי במצב מגע");
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const row = page.locator("tbody tr.row-link").first();
  await row.hover();
  const cell = row.locator("td").first();
  await expect
    .poll(() => styleOf(cell, "background-color"))
    .toBe(COLOR.primarySoft);
  expect(await styleOf(cell, "box-shadow")).toContain("rgb(65, 89, 199)");
});
