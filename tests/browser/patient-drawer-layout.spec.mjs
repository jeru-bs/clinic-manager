import { expect, test } from "@playwright/test";
import { patientRow, setupUiMocks } from "./helpers/ui-mocks.mjs";

// The fixed navigation bar sits along the bottom edge on narrow screens.
const MOBILE_NAV_HEIGHT = 72;

function isMobile() {
  return test.info().project.name.includes("mobile");
}

function expectedGap() {
  return isMobile() ? 12 : 24;
}

async function openDrawer(page) {
  await setupUiMocks(page, { seed: { patients: [patientRow("p1", "נועם", "300")] } });
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="open-patient-drawer"][data-id="p1"]').first().click();
  await expect(page.locator("#patientDrawer")).toBeVisible();
}

async function cardBox(page) {
  return page.locator("#patientDrawer .drawer-inner").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      overflowY: getComputedStyle(node).overflowY
    };
  });
}

test("the patient card keeps a clear gap from every viewport edge", async ({ page }) => {
  await openDrawer(page);
  const box = await cardBox(page);
  const gap = expectedGap();

  expect(box.top).toBeGreaterThanOrEqual(gap);
  expect(box.left).toBeGreaterThanOrEqual(gap);
  expect(box.viewportWidth - box.right).toBeGreaterThanOrEqual(gap);
  // On narrow screens the bottom gap also has to clear the fixed navigation bar.
  const bottomGap = box.viewportHeight - box.bottom;
  expect(bottomGap).toBeGreaterThanOrEqual(isMobile() ? gap + MOBILE_NAV_HEIGHT : gap);
});

test("the patient card fits inside the viewport and scrolls internally", async ({ page }) => {
  await openDrawer(page);
  const box = await cardBox(page);
  const gap = expectedGap();

  expect(box.width).toBeLessThanOrEqual(box.viewportWidth - gap * 2 + 1);
  const availableHeight = isMobile()
    ? box.viewportHeight - gap * 2 - MOBILE_NAV_HEIGHT
    : box.viewportHeight - gap * 2;
  expect(box.height).toBeLessThanOrEqual(availableHeight + 1);
  expect(box.overflowY).toBe("auto");

  // The whole page must never gain a sideways scrollbar because of the open card.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the card title stays fully inside the card, clear of its border and corners", async ({ page }) => {
  await openDrawer(page);
  const title = page.locator("#patientDrawerTitle");
  await expect(title).toBeVisible();
  await expect(title).toHaveText(/עריכת מטופל|הוספת מטופל/);

  const box = await cardBox(page);
  const titleBox = await title.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, right: rect.right, left: rect.left, bottom: rect.bottom };
  });

  // RTL: the title starts at the inline start, which is the right edge of the card.
  expect(titleBox.top).toBeGreaterThan(box.top);
  expect(box.right - titleBox.right).toBeGreaterThan(1);
  expect(titleBox.left).toBeGreaterThan(box.left);
  expect(titleBox.bottom).toBeLessThan(box.bottom);
});

test("a card taller than the screen scrolls to its last field without clipping the title", async ({ page }) => {
  await page.setViewportSize({ width: isMobile() ? 393 : 1280, height: 360 });
  await openDrawer(page);

  const before = await cardBox(page);
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

  const submit = page.locator("#patientDrawer button[type=submit]");
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();

  // Scrolling the content must not move the card itself off the top of the screen.
  const after = await cardBox(page);
  expect(after.top).toBeGreaterThanOrEqual(expectedGap());
  await expect(page.locator("#patientDrawerTitle")).toBeVisible();
});
