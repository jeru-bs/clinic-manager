import { expect, test } from "@playwright/test";
import { chargeRow, patientRow, sessionRow, setupUiMocks } from "./helpers/ui-mocks.mjs";
import { clickRowAction, openRowMenu } from "./helpers/row-menu.mjs";

const TS = "2026-08-01T08:00:00.000Z";
// A fixed Monday so "today" and "tomorrow" are stable for the day screen.
const FIXED_NOW = new Date("2026-09-07T08:30:00");
const TODAY = "2026-09-07";
const TOMORROW = "2026-09-08";
const YESTERDAY = "2026-09-06";

function timedSession(id, patientId, date, start, end, location, type, status = "scheduled") {
  return [id, patientId, date, start, end, location, type, "", "", `event-${id}`, TS, TS, "", "", status];
}

function paymentRow(id, patientId, amount, method, paymentStatus, receiptStatus, receiptFileId = "") {
  return [id, patientId, "", amount, method, paymentStatus, receiptStatus, "2026-08-10", receiptFileId, "", TS, TS];
}

function taskRow(id, patientId, title, status, dueDate) {
  return [id, patientId, title, "", status, dueDate, "manual", TS, TS, dueDate, ""];
}

function fileRow(id, patientId, name, type, url) {
  return [id, patientId, `drive-${id}`, `folder-${patientId}`, name, type, url, TS, TS];
}

const SEED = {
  // Fixed-day sessions fall on Wednesday so they never project onto the fixed Monday.
  patients: [patientRow("p1", "יעל לוי", "300"), patientRow("p2", "איתי מזרחי", "250"), patientRow("p3", "נועה כהן", "280")].map((row) => {
    const copy = [...row];
    copy[6] = "רביעי";
    return copy;
  }),
  contacts: [["c1", "p1", "parent", "דנה לוי", "אמא", "0501234567", "dana@example.com", "", "", TS, TS]],
  sessions: [
    timedSession("s2", "p3", TODAY, "11:30", "12:15", "בית ספר", "הדרכת הורים"),
    timedSession("s1", "p1", TODAY, "09:00", "09:45", "קליניקה", "טיפול"),
    timedSession("s5", "p2", TOMORROW, "16:00", "16:45", "קליניקה", "טיפול"),
    sessionRow("s3", "p1", "2026-08-10", "מפגש מתועד"),
    sessionRow("s4", "p2", "2026-08-12", "מפגש מתועד")
  ],
  session_charges: [chargeRow("ch1", "s3", "p1", "2026-08-10", "300"), chargeRow("ch2", "s4", "p2", "2026-08-12", "250")],
  payments: [
    paymentRow("pay1", "p1", "300", "cash", "paid", "needed"),
    paymentRow("pay2", "p2", "100", "bit", "unpaid", "not_needed"),
    paymentRow("pay3", "p3", "280", "cash", "paid", "issued", "receipt-file-3")
  ],
  tasks: [
    taskRow("t1", "p1", "לשלוח סיכום להורים", "open", YESTERDAY),
    taskRow("t2", "p2", "לתאם עם בית הספר", "open", TODAY),
    taskRow("t3", "p3", "להכין דוח התקדמות", "open", TOMORROW),
    taskRow("t4", "p1", "משימה שבוצעה", "done", YESTERDAY)
  ],
  files: [fileRow("f1", "p1", "הקלטה.m4a", "recording", "https://drive.google.com/file/d/rec-1"), fileRow("f2", "p2", "מסמך ללא קישור", "document", "")]
};

async function openApp(page, route) {
  await page.clock.setFixedTime(FIXED_NOW);
  // The fixed clock sits in the future, so the mock token must expire relative to it.
  await page.addInitScript((expiresAt) => {
    sessionStorage.setItem("clinic-manager-google-token", JSON.stringify({ accessToken: "test-token", expiresAt }));
  }, FIXED_NOW.getTime() + 60 * 60 * 1000);
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

// Horizontal distance between a flex child and the sibling rendered before it (RTL: to its right).
async function gapBefore(locator) {
  return locator.evaluate((el) => {
    const previous = el.previousElementSibling;
    if (!previous) return Infinity;
    return previous.getBoundingClientRect().left - el.getBoundingClientRect().right;
  });
}

function isMobile() {
  return test.info().project.name.includes("mobile");
}

test("the day screen shows today's date, a summary line and the sessions sorted by hour", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/dashboard");

  await expect(page.locator("h1").first()).toContainText("יום שני, 7.9.2026");
  await expect(page.locator("main")).toContainText("2 מפגשים היום · 2 חייבים · 3 משימות פתוחות");

  const rows = page.locator("[data-today-sessions] > .today-list > .today-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator(".today-time")).toHaveText("09:00");
  await expect(rows.nth(0).locator(".row-open")).toHaveText("יעל לוי");
  await expect(rows.nth(1).locator(".today-time")).toHaveText("11:30");
  await expect(rows.nth(1).locator(".row-open")).toHaveText("נועה כהן");
  // Type, location and status are separate pills; nothing is glued to the name.
  await expect(rows.nth(1).locator(".today-badges .status-pill")).toHaveText(["הדרכת הורים", "בית ספר", "מתוכנן"]);
  // 08:30 fixed time: the first scheduled session is the next one.
  await expect(rows.nth(0)).toHaveClass(/is-next/);

  const tomorrow = page.locator("[data-today-tomorrow]");
  await expect(tomorrow.locator("summary")).toContainText("מחר · 1 מפגשים");
  await expect(tomorrow.locator(".today-row")).toHaveCount(1);

  // The old cluttered blocks are gone.
  await expect(page.locator(".attention-grid")).toHaveCount(0);
  await expect(page.locator("main table")).toHaveCount(0);
});

test("the day screen lists open debts per patient and the three nearest tasks, overdue first", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/dashboard");

  const debts = page.locator("[data-today-debts] .today-row");
  await expect(debts).toHaveCount(2);
  await expect(debts.nth(0).locator(".row-open")).toHaveText("יעל לוי");
  await expect(debts.nth(0).locator(".today-meta")).toContainText("מאז 10.8.2026");
  await expect(debts.nth(0).locator(".today-amount")).toContainText("300.00");
  await expect(debts.nth(1).locator(".row-open")).toHaveText("איתי מזרחי");
  await expect(debts.nth(1).locator(".today-amount")).toContainText("250.00");
  await expect(page.locator("[data-today-debts] a.button", { hasText: "לכל התשלומים" })).toHaveAttribute("href", "#/payments");

  const tasks = page.locator("[data-today-tasks] .reminder-row");
  await expect(tasks).toHaveCount(3);
  await expect(tasks.nth(0)).toHaveClass(/overdue/);
  await expect(tasks.nth(0)).toContainText("לשלוח סיכום להורים");
  await expect(tasks.nth(1)).toContainText("לתאם עם בית הספר");
  await expect(tasks.nth(2)).toContainText("להכין דוח התקדמות");
  await expect(page.locator("[data-today-tasks]")).not.toContainText("משימה שבוצעה");
  await expect(page.locator("[data-today-tasks] a.button", { hasText: "לכל המשימות" })).toHaveAttribute("href", "#/tasks");

  // The debt menu jumps straight to the payment form of the patient card.
  const menu = await openRowMenu(debts.nth(0));
  await menu.getByRole("menuitem", { name: "רישום תשלום" }).click();
  expect(page.url()).toContain("#/patients/p1");
  await expect(page.locator('form[data-form="payment"]')).toBeVisible();
});

test("marking a session as completed from the day screen updates the stored row", async ({ page }) => {
  const { captured } = await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/dashboard");

  const row = page.locator('[data-session-row="s1"]');
  const menu = await openRowMenu(row);
  await expect(menu.getByRole("menuitem")).toHaveText(["פתיחת כרטיס", "עריכת מפגש", "סימון כהתקיים", "לא הגיע", "ביטול מפגש"]);
  await expect(menu.getByRole("menuitem", { name: "ביטול מפגש" })).toHaveClass(/danger/);
  await menu.getByRole("menuitem", { name: "סימון כהתקיים" }).click();

  await expect(page.getByText("המפגש סומן כהתקיים.")).toBeVisible();
  const sessionPut = captured.puts.find((entry) => entry.sheet === "sessions" && entry.row[0] === "s1");
  expect(sessionPut).toBeTruthy();
  expect(sessionPut.row[14]).toBe("completed");
  await expect(row.locator(".today-badges .status-pill").last()).toHaveText("התקיים");
});

test("an empty day offers a shortcut to schedule a session", async ({ page }) => {
  await setupUiMocks(page, { seed: { patients: SEED.patients } });
  await openApp(page, "/#/dashboard");

  const panel = page.locator("[data-today-sessions]");
  await expect(panel.locator(".empty")).toContainText("אין מפגשים מתוכננים להיום");
  await expect(panel.locator(".empty a.button", { hasText: "קביעת מפגש" })).toHaveAttribute("href", "#/patients");
  await expect(page.locator("[data-today-debts] .empty")).toContainText("אין חובות פתוחים");
});

test("badges and names in list items are separate flex children with a visible gap", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "תיעוד מפגש" }).click();

  const item = page.locator(".list-item", { hasText: "מפגש מתועד" }).first();
  const cells = item.locator("> .list-cell");
  await expect(cells).toHaveCount(2);
  await expect(cells.nth(1).locator("strong")).toHaveText("טיפול");
  await expect(cells.nth(1).locator("span")).toHaveText("יעל לוי");
  const layout = await cells.nth(1).evaluate((el) => {
    const style = getComputedStyle(el);
    const [strong, span] = el.children;
    return { display: style.display, direction: style.flexDirection, stacked: span.getBoundingClientRect().top >= strong.getBoundingClientRect().bottom };
  });
  expect(layout.display).toBe("flex");
  expect(layout.direction).toBe("column");
  expect(layout.stacked).toBe(true);
  // The pill is a sibling of the cells, not text inside them.
  await expect(item.locator("> .status-pill")).toHaveCount(1);
  expect(await gapBefore(item.locator("> .status-pill"))).toBeGreaterThanOrEqual(4);

  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();
  const payment = page.locator(".list-item", { hasText: "מזומן" }).first();
  await expect(payment.locator("> .list-cell").nth(1).locator("strong")).toHaveText("יעל לוי");
  await expect(payment.locator("> .list-cell").nth(1).locator("span")).toHaveText("מזומן");
  expect(await gapBefore(payment.locator("> .status-pill"))).toBeGreaterThanOrEqual(4);
});

test("the patients list shows email with school and phone with treatment type", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients");

  const headers = page.locator("thead th");
  await expect(headers.nth(1)).toHaveText("אימייל / מוסד");
  await expect(headers.nth(2)).toHaveText("טלפון / טיפול");

  const row = page.locator("tbody tr.row-link", { hasText: "יעל לוי" });
  const emailCell = row.locator('td[data-label="אימייל / מוסד"] .cell-stack');
  await expect(emailCell.locator("> span")).toHaveText("dana@example.com");
  await expect(emailCell.locator("small")).toHaveText("בית ספר");
  const phoneCell = row.locator('td[data-label="טלפון / טיפול"] .cell-stack');
  await expect(phoneCell.locator("> span")).toHaveText("0501234567");
  await expect(phoneCell.locator("small")).toHaveText("רגשי");

  // A patient without contacts shows a dash, never an empty cell.
  const bare = page.locator("tbody tr.row-link", { hasText: "איתי מזרחי" });
  await expect(bare.locator('td[data-label="אימייל / מוסד"] .cell-stack > span')).toHaveText("—");
});

test("the patient overview tab is a grid of grouped detail cards", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await openApp(page, "/#/patients/p1");

  const grid = page.locator(".overview-grid");
  await expect(grid.locator("[data-overview-card]")).toHaveCount(5);
  await expect(grid.locator("[data-overview-card] h2")).toHaveText(["פרטי הילד", "הורים / אנשי קשר", "מסגרת חינוכית", "טיפול ותשלום", "הערות"]);

  const contacts = grid.locator('[data-overview-card="contacts"]');
  await expect(contacts).toContainText("דנה לוי");
  await expect(contacts.getByRole("link", { name: "0501234567" })).toBeVisible();
  await expect(contacts.getByRole("link", { name: "dana@example.com" })).toBeVisible();

  const treatment = grid.locator('[data-overview-card="treatment"]');
  await expect(treatment.locator(".detail", { hasText: "מחיר קבוע" })).toContainText("300");
  await expect(treatment.locator(".detail", { hasText: "יתרת חוב" })).toContainText("300.00");
  // Empty values render as a dash.
  await expect(grid.locator('[data-overview-card="child"] .detail', { hasText: "כתובת" }).locator("strong")).toHaveText("—");
  await expect(grid.locator('[data-overview-card="notes"] .detail', { hasText: "הערות כלליות" }).locator("strong")).toHaveText("—");

  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(isMobile() ? 1 : 2);

  // The card action moves to the contacts section.
  await contacts.getByRole("button", { name: "ניהול אנשי קשר" }).click();
  await expect(page.locator(".profile-tab.active")).toContainText("הורים ואנשי מקצוע");
});

test("tasks, payments and files rows keep one inline action and move the rest into a menu", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  page.on("dialog", (dialog) => dialog.accept());

  await openApp(page, "/#/tasks");
  const taskRows = page.locator("tbody tr", { hasText: "לשלוח סיכום להורים" });
  await expect(taskRows.locator(".button.danger")).toHaveCount(0);
  await expect(taskRows.locator('[data-action="toggle-row-menu"]')).toHaveCount(1);
  await expect(taskRows.locator('.row-actions > .button[data-action="complete-task"]')).toBeVisible();
  let menu = await openRowMenu(taskRows);
  await expect(menu.getByRole("menuitem")).toHaveText(["כרטיס מטופל", "עריכה", "מחיקה"]);
  await expect(menu.getByRole("menuitem", { name: "מחיקה" })).toHaveClass(/danger/);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await openApp(page, "/#/payments");
  const unpaid = page.locator("tbody tr", { hasText: "איתי מזרחי" }).filter({ hasText: "ביט" });
  await expect(unpaid.locator('.row-actions > .button[data-action="set-payment-status"][data-status="paid"]')).toBeVisible();
  await expect(unpaid.locator(".button.danger")).toHaveCount(0);
  menu = await openRowMenu(unpaid);
  await expect(menu.getByRole("menuitem")).toHaveText(["כרטיס מטופל", "עריכה", "מחיקה"]);
  await page.mouse.click(5, 5);
  await expect(menu).toBeHidden();

  const issued = page.locator("tbody tr", { hasText: "נועה כהן" });
  await expect(issued.locator('.row-actions > .button[data-action="edit-payment"]')).toBeVisible();
  menu = await openRowMenu(issued);
  await expect(menu.getByRole("menuitem")).toHaveText(["כרטיס מטופל", "פתח", "מחיקת קבלה", "מחיקה"]);
  await clickRowAction(page, 'button[data-action="delete-payment"][data-id="pay3"]');
  await expect(page.getByText("התשלום נמחק מהמערכת.")).toBeVisible();

  await openApp(page, "/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "קבצים" }).click();
  const recording = page.locator("tbody tr", { hasText: "הקלטה.m4a" });
  await expect(recording.locator(".row-actions > a.button", { hasText: "פתיחה" })).toBeVisible();
  menu = await openRowMenu(recording);
  await expect(menu.getByRole("menuitem")).toHaveText(["כרטיס מטופל", "עריכה", "טיוטת תמלול", "מחיקה"]);
});

test("no screen scrolls horizontally on a 390px viewport and day-screen tap targets are 44px", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/#/dashboard", "/#/patients", "/#/patients/p1", "/#/calendar", "/#/payments"]) {
    await openApp(page, route);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    expect(overflow.scrollWidth, route).toBeLessThanOrEqual(overflow.innerWidth);
  }

  await openApp(page, "/#/dashboard");
  const heights = await page.locator("[data-today-sessions] .icon-button, [data-today-tasks] .button.table-button").evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height)
  );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
  // The fixed bottom navigation never covers the last content block.
  const clearance = await page.evaluate(() => {
    const main = document.querySelector("main") || document.querySelector(".main");
    const nav = document.querySelector(".side-nav");
    const style = getComputedStyle(main);
    return { paddingBottom: parseFloat(style.paddingBottom), navHeight: nav ? nav.getBoundingClientRect().height : 0 };
  });
  expect(clearance.paddingBottom).toBeGreaterThanOrEqual(clearance.navHeight);
});
