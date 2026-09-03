import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

const TS = "2026-01-01T08:00:00.000Z";

// patients: ..., fixed_start_date, fixed_end_date, no_show_policy, no_show_fee
function policyPatientRow(id, name, fixedPrice, policy, fee = "") {
  const row = patientRow(id, name, fixedPrice);
  row[21] = policy;
  row[22] = fee;
  return row;
}

function sessionRow(id, patientId, date) {
  return [id, patientId, date, "10:00", "10:50", "קליניקה", "טיפול", "", "", "event-1", TS, TS, "", "", "scheduled"];
}

function appendsFor(captured, sheet) {
  return captured.appends.filter((entry) => entry.sheet === sheet);
}

async function openSessionEditor(page, patients) {
  const mocks = await setupUiMocks(page, {
    seed: { patients, sessions: [sessionRow("s1", "p1", "2026-08-10")] }
  });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await page.locator('[data-action="edit-session"]').first().click();
  await expect(page.locator('form[data-form="session"] button[type=submit]')).toHaveText("עדכון מפגש");
  return mocks;
}

async function setStatus(page, status) {
  await page.locator("#session_status").selectOption(status);
  await page.locator('form[data-form="session"] button[type=submit]').click();
  await expect(page.locator("[data-app-message]")).toBeVisible();
}

test("a no-show with a full policy is charged the session price and shows up as a debt", async ({ page }) => {
  const { captured } = await openSessionEditor(page, [policyPatientRow("p1", "נועם כהן", "300", "full")]);
  await expect(page.locator("#session_status option")).toHaveCount(5);
  await expect(page.locator('#session_status option[value="cancelled_late"]')).toHaveText("ביטול מאוחר");

  await setStatus(page, "no_show");
  await expect(page.locator("[data-app-message]")).toContainText("נוסף חיוב לפי מדיניות הביטולים");

  const charges = appendsFor(captured, "session_charges");
  expect(charges).toHaveLength(1);
  const [, sessionId, patientId, sessionDate, amount] = charges[0].row;
  expect(sessionId).toBe("s1");
  expect(patientId).toBe("p1");
  expect(sessionDate).toBe("2026-08-10");
  expect(amount).toBe("300.00");

  // The charge is labelled as a no-show in the patient's payments tab and counted as a debt.
  await page.locator('[data-action="profile-tab"][data-tab="payments"]').first().click();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first()).toContainText("אי-הגעה");

  await page.goto("/#/");
  await expect(page.locator("[data-today-debts]")).toContainText("נועם כהן");
  await expect(page.locator("[data-today-debts] .today-amount")).toContainText("300.00");

  // Turning the no-show into a plain cancellation removes the unpaid fee again.
  await page.goto("/#/patients/p1");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await page.locator('[data-action="edit-session"]').first().click();
  await setStatus(page, "cancelled");
  await expect(page.locator("[data-app-message]")).toContainText("חיוב הביטול הוסר");
  expect(captured.clears.filter((entry) => entry.sheet === "session_charges")).toHaveLength(1);
  await page.goto("/#/");
  await expect(page.locator("[data-today-debts]")).toContainText("אין חובות פתוחים");
});

test("a patient with no charging policy is never charged for a no-show", async ({ page }) => {
  const { captured } = await openSessionEditor(page, [policyPatientRow("p1", "נועם כהן", "300", "none")]);
  await setStatus(page, "no_show");
  await expect(page.locator("[data-app-message]")).not.toContainText("נוסף חיוב");
  expect(appendsFor(captured, "session_charges")).toHaveLength(0);
  await page.goto("/#/");
  await expect(page.locator("[data-today-debts]")).toContainText("אין חובות פתוחים");
});

test("a fixed policy charges its fee and a late cancellation is charged like a no-show", async ({ page }) => {
  const { captured } = await openSessionEditor(page, [policyPatientRow("p1", "נועם כהן", "300", "fixed", "120")]);
  await setStatus(page, "cancelled_late");
  const charges = appendsFor(captured, "session_charges");
  expect(charges).toHaveLength(1);
  expect(charges[0].row[4]).toBe("120.00");

  await page.locator('[data-action="profile-tab"][data-tab="payments"]').first().click();
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first()).toContainText("ביטול מאוחר");
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("120.00");
});

test("the patient form saves the cancellation policy and reveals the fee only for a fixed amount", async ({ page }) => {
  const { captured } = await setupUiMocks(page, { seed: { patients: [policyPatientRow("p1", "נועם כהן", "300", "")] } });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".profile-details, .panel").filter({ hasText: "מדיניות ביטולים" }).first()).toContainText("ללא חיוב");

  await page.locator('[data-action="open-patient-drawer"][data-id="p1"]').first().click();
  await expect(page.locator("#patientDrawer")).toBeVisible();
  const feeField = page.locator("#patientDrawer [data-no-show-fee-field]");
  await expect(page.locator("#no_show_policy")).toHaveValue("");
  await expect(feeField).toBeHidden();
  await page.locator("#no_show_policy").selectOption("fixed");
  await expect(feeField).toBeVisible();
  await page.locator("#no_show_fee").fill("150");
  await page.locator("#patientDrawer button[type=submit]").click();

  await expect.poll(() => captured.puts.filter((entry) => entry.sheet === "patients").length).toBe(1);
  const saved = captured.puts.find((entry) => entry.sheet === "patients").row;
  expect(saved[21]).toBe("fixed");
  expect(saved[22]).toBe("150");
  await expect(page.locator(".panel").filter({ hasText: "מדיניות ביטולים" }).first()).toContainText("סכום קבוע");
});
