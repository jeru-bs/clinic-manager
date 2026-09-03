import { expect } from "@playwright/test";

// Row actions live either inline (the single primary button) or inside the row's overflow
// menu. Specs call this with the same selector they used before the menus existed.
export async function clickRowAction(page, selector) {
  const target = page.locator(selector).first();
  if (await target.isVisible()) {
    await target.click();
    return;
  }
  const menu = target.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' row-menu ')][1]");
  await menu.locator('[data-action="toggle-row-menu"]').click();
  await expect(target).toBeVisible();
  await target.click();
}

export async function openRowMenu(scope) {
  await scope.locator('[data-action="toggle-row-menu"]').first().click();
  const list = scope.locator('.row-menu-list[role="menu"]').first();
  await expect(list).toBeVisible();
  return list;
}
