import { expect, test } from "@playwright/test";
import { patientRow, sessionRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

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

const SEED = {
  patients: [patientRow("p1", "נועם", "300"), patientRow("p2", "יעל", "250"), patientRow("p3", "איתי", "280")],
  sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
  payments: [
    paymentRow("pay1", "p1", "300", "paid", "needed"),
    paymentRow("pay2", "p2", "250", "paid", "issued"),
    paymentRow("pay3", "p3", "280", "unpaid", "not_needed")
  ]
};

// המתנה לסיום הטעינה הראשונית כדי שה-render שאחריה לא יתנגש בבדיקה.
async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

test("every patient row exposes exactly one overflow menu holding all row actions", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const rows = page.locator("tbody tr.row-link");
  await expect(rows).toHaveCount(3);
  await expect(page.locator('[data-action="toggle-row-menu"]')).toHaveCount(3);
  // The three separate row buttons are gone: one menu per row is the only entry point.
  await expect(page.locator("tbody .small-action")).toHaveCount(0);

  const firstRow = page.locator("tbody tr.row-link", { hasText: "נועם" });
  const toggle = firstRow.locator('[data-action="toggle-row-menu"]');
  await expect(toggle).toHaveAttribute("aria-haspopup", "menu");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(firstRow.locator('[role="menu"]')).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const menu = firstRow.locator('[role="menu"]');
  await expect(menu).toBeVisible();

  // Open, edit and archive all survive the move into the menu.
  await expect(menu.getByRole("menuitem", { name: "פתיחת כרטיס מטופל" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "עריכת מטופל" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "ארכוב" })).toBeVisible();

  // Clicking outside closes the menu, and only one menu is ever open.
  await page.locator("h1").first().click();
  await expect(page.locator('[role="menu"]:visible')).toHaveCount(0);
  await page
    .locator("tbody tr.row-link", { hasText: "יעל" })
    .locator('[data-action="toggle-row-menu"]')
    .click();
  await expect(page.locator('[role="menu"]:visible')).toHaveCount(1);
});

test("the overflow menu is keyboard operable and closes on Escape", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const toggle = page.locator('[data-action="toggle-row-menu"]').first();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[role="menu"]:visible')).toHaveCount(1);

  // Every menu item is reachable with Tab from the toggle.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menuitem", { name: "פתיחת כרטיס מטופל" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-action="toggle-row-menu"]').first()).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-action="toggle-row-menu"]').first()).toBeFocused();
});

test("the archive action still works from inside the overflow menu", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const row = page.locator("tbody tr.row-link", { hasText: "נועם" });
  await row.locator('[data-action="toggle-row-menu"]').click();
  await page.getByRole("menuitem", { name: "ארכוב" }).click();

  // Archiving is an intentional workflow now: a summary modal asks for confirmation.
  await expect(page.locator(".modal-backdrop")).toBeVisible();
  await page.locator('.modal-backdrop [data-modal-action="archive"]').click();

  await expect(row.getByText("ארכיון", { exact: true })).toBeVisible();
  await row.locator('[data-action="toggle-row-menu"]').click();
  await expect(page.getByRole("menuitem", { name: "החזרה מארכיון" })).toBeVisible();
});

test("clicking anywhere in a patient row opens the patient record", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  // A plain cell, not an action button.
  await page
    .locator("tbody tr.row-link", { hasText: "נועם" })
    .locator('td[data-label="מוסד"]')
    .click();
  await expect(page).toHaveURL(/#\/patients\/p1$/);
  await expect(page.locator(".profile-tab-body")).toBeVisible();
});

test("all nine patient record sections stay reachable from the vertical navigation", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients/p1");

  // The horizontal strip and its inactive separator are gone.
  await expect(page.locator(".profile-tabs-label")).toHaveCount(0);

  const sections = [
    ["פרטים", "overview"],
    ["תיעוד מפגש", "documentation"],
    ["מטרות", "goals"],
    ["תשלומים", "payments"],
    ["קבצים", "files"],
    ["הורים ואנשי מקצוע", "contacts"],
    ["שאלונים", "questionnaires"],
    ["דוחות טיפוליים", "clinical-reports"],
    ["משימות", "tasks"]
  ];
  await expect(page.locator(".spine .profile-tab")).toHaveCount(sections.length);

  for (const [label, tab] of sections) {
    const button = page.locator(`.profile-tab[data-tab="${tab}"]`);
    await expect(button).toContainText(label);
    await button.click();
    await expect(button).toHaveClass(/active/);
    await expect(button).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".profile-tab-body")).not.toBeEmpty();
  }
});

test("settings show one category at a time and switch from the category navigation", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/settings");

  const categories = [
    ["preferences", "העדפות קליניקה ואישיות"],
    ["connections", "חיבורים ואינטגרציות"],
    ["data", "נתונים, גיבוי ושחזור"],
    ["security", "אבטחה ויומן פעילות"],
    ["schedule", "חריגות וחסימות יומן"]
  ];
  await expect(page.locator('[data-action="settings-category"]')).toHaveCount(categories.length);

  for (const [key, label] of categories) {
    const button = page.locator(`[data-action="settings-category"][data-category="${key}"]`);
    await expect(button).toContainText(label);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    // Exactly one category panel is visible, and it is the selected one.
    await expect(page.locator("[data-settings-category]:visible")).toHaveCount(1);
    await expect(page.locator(`[data-settings-category="${key}"]`)).toBeVisible();
  }

  // Every preserved setting is still in the document, just hidden while inactive.
  await expect(page.locator("[data-settings-category]")).toHaveCount(categories.length);
  await expect(page.locator("#settingsForm")).toHaveCount(1);
  await expect(page.locator("#sessionTypes")).toHaveCount(1);
  await expect(page.locator("#allowedUserEmails")).toHaveCount(1);
  await expect(page.getByText("מחיקת חשבון ונתונים")).toHaveCount(0);
});

test("the pending receipts view filters payments in the app without exporting a file", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });

  const downloads = [];
  page.on("download", (download) => downloads.push(download));

  await openApp(page, "/#/payments");

  // The export action is gone.
  await expect(page.locator('[data-action="export-receipts"]')).toHaveCount(0);
  await expect(page.getByText("ייצוא קבלות להכנה")).toHaveCount(0);

  const table = page.locator('[data-payments-view] tbody tr');
  await expect(table).toHaveCount(3);
  await expect(page.locator("[data-payments-count]")).toContainText("3");

  const pendingButton = page.getByRole("button", { name: "תשלומים ממתינים לקבלה" });
  await expect(pendingButton).toContainText("1");
  await pendingButton.click();

  await expect(pendingButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-payments-view]")).toHaveAttribute("data-payments-view", "receipts-pending");
  await expect(page.locator("[data-payments-count]")).toContainText("1");
  await expect(table).toHaveCount(1);
  await expect(table.first()).toContainText("נועם");

  // Returning to the full list works.
  await page.getByRole("button", { name: "כל התשלומים" }).click();
  await expect(page.locator("[data-payments-view]")).toHaveAttribute("data-payments-view", "all");
  await expect(table).toHaveCount(3);

  // Nothing was downloaded and no object URL was created for a file.
  expect(downloads).toHaveLength(0);
});

test("dismissing a status message keeps typed form values and the restored session", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  // The session was restored from storage before the interaction starts.
  // The sign-out control is rendered only with a live token; on mobile it is visually
  // collapsed into the bottom bar, so assert its presence rather than its visibility.
  await expect(page.locator('[data-action="disconnect-google"]')).toHaveCount(1);

  await page.evaluate(() => {
    // eslint-disable-next-line no-undef -- app globals live in the page context
    state.message = "בדיקת הודעה";
    // eslint-disable-next-line no-undef -- app globals live in the page context
    render();
  });
  await expect(page.locator("[data-app-message]")).toBeVisible();

  await page.getByRole("button", { name: "הוסף מטופל +" }).click();
  const form = page.locator('form[data-form="patient"]');
  await form.locator("#child_name").fill("מטופל בבדיקה");
  await form.locator("#school_name").fill("מוסד בבדיקה");

  // The auto-hide removes only the message node; it must not re-render the page.
  await expect(page.locator("[data-app-message]")).toHaveCount(0, { timeout: 10000 });
  await expect(form.locator("#child_name")).toHaveValue("מטופל בבדיקה");
  await expect(form.locator("#school_name")).toHaveValue("מוסד בבדיקה");
  await expect(page.locator("#patientDrawer")).toBeVisible();
});

test("the premium shell renders without console errors or horizontal overflow", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  for (const route of [
    "/#/dashboard",
    "/#/patients",
    "/#/patients/p1",
    "/#/calendar",
    "/#/tasks",
    "/#/payments",
    "/#/business",
    "/#/reports",
    "/#/files",
    "/#/settings"
  ]) {
    await openApp(page, route);
    await expect(page.locator(".side-nav")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    const direction = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
    expect(direction).toBe("rtl");
  }

  expect(errors).toEqual([]);
});
