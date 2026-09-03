import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

const TS = "2026-01-01T08:00:00.000Z";

function isMobile() {
  return test.info().project.name.includes("mobile");
}

function schoolPatientRow(id, name, school) {
  const row = patientRow(id, name, "300");
  row[3] = school;
  return row;
}

// contacts: id, patient_id, contact_type, name, relationship, phone, email, organization, notes, created_at, updated_at
function contactRow(id, patientId, type, name, phone, extra = {}) {
  return [id, patientId, type, name, extra.relationship || "", phone, extra.email || "", extra.organization || "", "", TS, TS];
}

const SEED = {
  patients: [
    schoolPatientRow("p1", "נועם כהן", "בית ספר אורנים"),
    schoolPatientRow("p2", "דנה לוי", "גן שקד"),
    schoolPatientRow("p3", "נועה ברק", "בית ספר אורנים")
  ],
  contacts: [
    contactRow("c1", "p1", "parent", "רונית כהן", "050-1234567", { relationship: "אמא", email: "ronit@example.com" }),
    contactRow("c2", "p2", "parent", "יוסי לוי", "+972-52-7654321", { relationship: "אבא" }),
    contactRow("c3", "p2", "professional", "מיכל ברק", "03-5551234", { relationship: "גננת", organization: "גן שקד" })
  ]
};

async function openApp(page, path = "/#/") {
  const mocks = await setupUiMocks(page, { seed: SEED });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  if (isMobile()) {
    await page.locator('[data-action="toggle-global-search"]').click();
  }
  await expect(page.locator("[data-global-search-input]")).toBeVisible();
  return mocks;
}

function results(page) {
  return page.locator("#globalSearchResults [role=option][data-id]");
}

test("typing parent phone digits finds the patient and explains the match", async ({ page }) => {
  await openApp(page, "/#/tasks");
  const input = page.locator("[data-global-search-input]");
  await expect(input).toHaveAttribute("placeholder", "חיפוש: שם ילד, טלפון הורה, בית ספר…");

  await input.fill("0501234");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("נועם כהן");
  await expect(results(page).first()).toContainText("טלפון הורה: 050-1234567");
  await expect(page.locator("#globalSearchResults")).toHaveAttribute("role", "listbox");

  // +972 numbers are matched by their local digits, in either direction.
  await input.fill("0527654");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("דנה לוי");

  // A single character is not searched yet.
  await input.fill("0");
  await expect(page.locator("#globalSearchResults")).toBeHidden();

  await input.fill("0501234");
  await results(page).first().click();
  await expect(page).toHaveURL(/#\/patients\/p1$/);
  await expect(page.locator("#globalSearchResults")).toBeHidden();
});

test("searching by school lists every child in that school and by contact organisation", async ({ page }) => {
  await openApp(page, "/#/payments");
  const input = page.locator("[data-global-search-input]");

  await input.fill("אורנים");
  await expect(results(page)).toHaveCount(2);
  await expect(results(page).nth(0)).toContainText("מוסד: בית ספר אורנים");
  await expect(results(page).nth(0)).toContainText("נועה ברק");
  await expect(results(page).nth(1)).toContainText("נועם כהן");

  await input.fill("גננת");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page).first()).toContainText("דנה לוי");
  await expect(results(page).first()).toContainText("תפקיד: גננת");

  await input.fill("xyz-nothing");
  await expect(page.locator("#globalSearchResults")).toContainText("לא נמצאו תוצאות");
  await expect(results(page)).toHaveCount(0);
});

test("arrow keys move the highlight, Enter opens the card and Escape closes the list", async ({ page }) => {
  await openApp(page, "/#/");
  const input = page.locator("[data-global-search-input]");

  await input.fill("נוע");
  await expect(results(page)).toHaveCount(2);
  await expect(results(page).nth(0)).toContainText("נועה ברק");
  await expect(results(page).nth(1)).toContainText("נועם כהן");

  await input.press("ArrowDown");
  await expect(results(page).nth(0)).toHaveClass(/is-active/);
  await expect(results(page).nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute("aria-activedescendant", "globalSearchResult-0");
  await input.press("ArrowDown");
  await expect(results(page).nth(1)).toHaveClass(/is-active/);
  await expect(results(page).nth(0)).toHaveAttribute("aria-selected", "false");
  await input.press("ArrowUp");
  await expect(results(page).nth(0)).toHaveClass(/is-active/);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/patients\/p1$/);
  await expect(page.locator("#globalSearchResults")).toBeHidden();
  await expect(page.locator(".profile-title, h1").first()).toContainText("נועם כהן");

  if (isMobile()) await page.locator('[data-action="toggle-global-search"]').click();
  const reopened = page.locator("[data-global-search-input]");
  await reopened.fill("דנ");
  await expect(results(page)).toHaveCount(1);
  await reopened.press("Escape");
  await expect(page.locator("#globalSearchResults")).toBeHidden();
  await expect(reopened).toHaveValue("");
  await expect(page).toHaveURL(/#\/patients\/p1$/);

  // Enter with nothing highlighted opens the first result.
  if (isMobile()) await page.locator('[data-action="toggle-global-search"]').click();
  await page.locator("[data-global-search-input]").fill("דנה");
  await expect(results(page)).toHaveCount(1);
  await page.locator("[data-global-search-input]").press("Enter");
  await expect(page).toHaveURL(/#\/patients\/p2$/);
});

test("on a phone the search is an icon that expands into the field", async ({ page }) => {
  test.skip(!isMobile(), "the collapsed search icon only exists on narrow screens");
  await setupUiMocks(page, { seed: SEED });
  await page.goto("/#/");
  await page.waitForLoadState("networkidle");

  const toggle = page.locator('[data-action="toggle-global-search"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-global-search-input]")).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("[data-global-search-input]")).toBeVisible();
  await expect(page.locator("[data-global-search-input]")).toBeFocused();

  await page.locator("[data-global-search-input]").fill("שקד");
  await expect(results(page)).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await toggle.click();
  await expect(page.locator("[data-global-search-input]")).toBeHidden();
});

test("the desktop sidebar shows the field on every page without a toggle", async ({ page }) => {
  test.skip(isMobile(), "desktop layout only");
  await setupUiMocks(page, { seed: SEED });
  for (const path of ["/#/", "/#/patients", "/#/calendar", "/#/settings"]) {
    await page.goto(path);
    await expect(page.locator(".side-nav [data-global-search-input]")).toBeVisible();
    await expect(page.locator('[data-action="toggle-global-search"]')).toBeHidden();
  }
});
