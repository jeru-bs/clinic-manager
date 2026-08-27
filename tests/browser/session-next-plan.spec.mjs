import { expect, test } from "@playwright/test";
import { patientRow, sessionRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

const NEXT_PLAN_COLUMN = 13; // sessions: ..., document_file_id, next_plan

async function openDocumentation(page, seed = {}) {
  const mocks = await setupUiMocks(page, {
    seed: { patients: [patientRow("p1", "נועם", "300")], ...seed }
  });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await expect(page.locator('form[data-form="session"]')).toBeVisible();
  return mocks;
}

test("a next-session plan is saved with the session and restored when it is edited", async ({ page }) => {
  const { captured } = await openDocumentation(page);
  await expect(page.locator("#next_plan")).toHaveAttribute(
    "placeholder",
    "מה חשוב להמשיך, לבדוק או להכין למפגש הבא?"
  );
  await expect(page.locator('label[for="next_plan"]')).toHaveText("תכנון למפגש הבא");

  await page.locator("#summary").fill("מפגש ראשון");
  await page.locator("#next_plan").fill("להביא כרטיסיות רגשות");
  await page.locator('form[data-form="session"] button[type=submit]').click();

  await expect.poll(() => captured.appends.filter((entry) => entry.sheet === "sessions").length).toBe(1);
  const saved = captured.appends.find((entry) => entry.sheet === "sessions");
  expect(saved.row[NEXT_PLAN_COLUMN]).toBe("להביא כרטיסיות רגשות");

  await page.locator('[data-action="edit-session"]').first().click();
  await expect(page.locator('form[data-form="session"] button[type=submit]')).toHaveText("עדכון מפגש");
  await expect(page.locator("#next_plan")).toHaveValue("להביא כרטיסיות רגשות");

  await page.locator("#next_plan").fill("לחזור על הכרטיסיות ולהוסיף משחק תפקידים");
  await page.locator('form[data-form="session"] button[type=submit]').click();
  await expect.poll(() => captured.puts.filter((entry) => entry.sheet === "sessions").length).toBeGreaterThan(0);
  const updated = captured.puts.filter((entry) => entry.sheet === "sessions").at(-1);
  expect(updated.row[NEXT_PLAN_COLUMN]).toBe("לחזור על הכרטיסיות ולהוסיף משחק תפקידים");
});

test("the preceding session plan appears in the next session form with its source date", async ({ page }) => {
  await openDocumentation(page, {
    sessions: [
      sessionRow("s1", "p1", "2026-08-10", "מפגש ישן", "תכנון ישן"),
      sessionRow("s2", "p1", "2026-08-17", "מפגש אחרון", "להביא כרטיסיות רגשות")
    ]
  });

  const callout = page.locator("[data-previous-plan]");
  await expect(callout).toBeVisible();
  await expect(callout).toHaveAttribute("data-previous-plan", "s2");
  await expect(callout).toContainText("מה תכננתי למפגש הזה");
  await expect(callout).toContainText("להביא כרטיסיות רגשות");
  await expect(callout).toContainText("17.8.2026");

  // Editing the source session itself must not show that session's own plan back to it.
  await page.locator('[data-action="edit-session"]').first().click();
  await expect(page.locator('form[data-form="session"] button[type=submit]')).toHaveText("עדכון מפגש");
  await expect(page.locator("[data-previous-plan]")).toHaveAttribute("data-previous-plan", "s1");
});

test("no callout is rendered when no preceding session carries a plan", async ({ page }) => {
  await openDocumentation(page, {
    sessions: [sessionRow("s1", "p1", "2026-08-10", "מפגש ישן")]
  });
  await expect(page.locator("[data-previous-plan]")).toHaveCount(0);
});

test("the generated session document contains the next-session plan heading", async ({ page }) => {
  const { captured } = await openDocumentation(page);
  await page.locator("#summary").fill("מפגש ראשון");
  await page.locator("#next_plan").fill("להביא כרטיסיות רגשות");
  await page.locator('form[data-form="session"] button[type=submit]').click();

  await expect.poll(() => captured.documentInserts.length).toBeGreaterThan(0);
  const documentText = captured.documentInserts.at(-1);
  expect(documentText).toContain("תכנון למפגש הבא:");
  expect(documentText).toContain("להביא כרטיסיות רגשות");
});
