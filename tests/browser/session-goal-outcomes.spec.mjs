import { expect, test } from "@playwright/test";
import { goalRow, patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

const OUTCOME_LABELS = ["בוצע היטב", "התקדמות חלקית", "קושי", "המטרה הושגה"];

function goalUpdateRow(row) {
  // goal_updates: id, goal_id, patient_id, session_id, progress, status, note, created_at, updated_at, outcome
  return { id: row[0], goalId: row[1], sessionId: row[3], progress: row[4], status: row[5], note: row[6], outcome: row[9] };
}

async function openSessionForm(page, { seed } = {}) {
  const mocks = await setupUiMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      goals: [goalRow("g1", "p1", "שיפור ויסות", "20")],
      ...seed
    }
  });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await expect(page.locator('form[data-form="session"]')).toBeVisible();
  return mocks;
}

function outcomeButton(page, outcome) {
  return page.locator(`[data-goal-outcome-group="g1"] [data-outcome="${outcome}"]`);
}

test("the quick goal buttons render, are accessible and stay mutually exclusive", async ({ page }) => {
  await openSessionForm(page);
  const group = page.locator('[data-goal-outcome-group="g1"]');
  await expect(group).toHaveAttribute("role", "group");

  const buttons = group.locator('[data-action="set-goal-outcome"]');
  await expect(buttons).toHaveCount(4);
  for (const label of OUTCOME_LABELS) {
    await expect(group.getByRole("button", { name: label })).toBeVisible();
  }
  await expect(group.locator('[data-action="set-goal-outcome"][aria-pressed="true"]')).toHaveCount(0);

  await outcomeButton(page, "partial").click();
  await expect(outcomeButton(page, "partial")).toHaveAttribute("aria-pressed", "true");
  await expect(outcomeButton(page, "well")).toHaveAttribute("aria-pressed", "false");

  await outcomeButton(page, "difficulty").click();
  await expect(outcomeButton(page, "difficulty")).toHaveAttribute("aria-pressed", "true");
  await expect(outcomeButton(page, "partial")).toHaveAttribute("aria-pressed", "false");
  const pressed = await group.locator('[data-action="set-goal-outcome"][aria-pressed="true"]').count();
  expect(pressed).toBe(1);
});

test("selecting an outcome saves nothing before the session form is submitted", async ({ page }) => {
  const { captured } = await openSessionForm(page);
  await outcomeButton(page, "well").click();
  await outcomeButton(page, "achieved").click();

  expect(captured.appends.filter((entry) => entry.sheet === "goal_updates")).toHaveLength(0);
  expect(captured.puts.filter((entry) => entry.sheet === "goal_updates")).toHaveLength(0);
  expect(captured.appends.filter((entry) => entry.sheet === "sessions")).toHaveLength(0);
});

test("המטרה הושגה saves progress 100 and an achieved goal status", async ({ page }) => {
  const { captured } = await openSessionForm(page);
  await outcomeButton(page, "achieved").click();
  await expect(page.locator("#goal_progress_g1")).toHaveValue("100");

  await page.locator('form[data-form="session"] button[type=submit]').click();
  await expect(page.locator('form[data-form="session"]')).toBeVisible();
  await expect
    .poll(() => captured.appends.filter((entry) => entry.sheet === "goal_updates").length)
    .toBe(1);

  const update = goalUpdateRow(captured.appends.find((entry) => entry.sheet === "goal_updates").row);
  expect(update.outcome).toBe("achieved");
  expect(update.progress).toBe("100");
  expect(update.status).toBe("achieved");

  await expect.poll(() => captured.puts.filter((entry) => entry.sheet === "goals").length).toBe(1);
  const goalPut = captured.puts.filter((entry) => entry.sheet === "goals").at(-1);
  expect(goalPut.row[4]).toBe("achieved");
  expect(goalPut.row[5]).toBe("100");
});

test("the other outcomes never change the numerical progress on their own", async ({ page }) => {
  const { captured } = await openSessionForm(page);
  for (const outcome of ["well", "partial", "difficulty"]) {
    await outcomeButton(page, outcome).click();
    await expect(page.locator("#goal_progress_g1")).toHaveValue("20");
  }

  await page.locator('form[data-form="session"] button[type=submit]').click();
  await expect
    .poll(() => captured.appends.filter((entry) => entry.sheet === "goal_updates").length)
    .toBe(1);

  const update = goalUpdateRow(captured.appends.find((entry) => entry.sheet === "goal_updates").row);
  expect(update.outcome).toBe("difficulty");
  expect(update.progress).toBe("20");
  expect(update.status).toBe("active");
});

test("editing a session restores its outcome and rewrites the same goal-update row", async ({ page }) => {
  const { captured } = await openSessionForm(page);
  await outcomeButton(page, "partial").click();
  await page.locator("#goal_note_g1").fill("עבדנו על נשימות");
  await page.locator("#summary").fill("מפגש ראשון");
  await page.locator('form[data-form="session"] button[type=submit]').click();

  await expect
    .poll(() => captured.appends.filter((entry) => entry.sheet === "goal_updates").length)
    .toBe(1);
  const created = goalUpdateRow(captured.appends.find((entry) => entry.sheet === "goal_updates").row);
  expect(created.outcome).toBe("partial");

  await page.locator('[data-action="edit-session"]').first().click();
  await expect(page.locator('form[data-form="session"] button[type=submit]')).toHaveText("עדכון מפגש");
  // The saved outcome, progress and note come back exactly as they were stored.
  await expect(outcomeButton(page, "partial")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#goal_note_g1")).toHaveValue("עבדנו על נשימות");
  await expect(page.locator("#goal_progress_g1")).toHaveValue("20");

  await outcomeButton(page, "difficulty").click();
  await page.locator('form[data-form="session"] button[type=submit]').click();

  await expect
    .poll(() => captured.puts.filter((entry) => entry.sheet === "goal_updates").length)
    .toBe(1);
  // No duplicate row: the second save updated the row created by the first one.
  expect(captured.appends.filter((entry) => entry.sheet === "goal_updates")).toHaveLength(1);
  const rewritten = goalUpdateRow(captured.puts.find((entry) => entry.sheet === "goal_updates").row);
  expect(rewritten.id).toBe(created.id);
  expect(rewritten.outcome).toBe("difficulty");
});
