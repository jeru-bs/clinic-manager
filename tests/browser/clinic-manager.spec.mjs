import { expect, test } from "@playwright/test";

test("the access gate does not expose the authorized email list", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "התחברות לחשבון מורשה" })).toBeVisible();
  await expect(page.getByText("הכניסה מוגבלת לחשבונות Google שאושרו מראש.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("azaidman1@gmail.com");
  await expect(page.locator("body")).not.toContainText("malki.frankel@gmail.com");
});

test("a blocked Google popup produces an actionable Hebrew error", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", async (route) => {
    await route.fulfill({
      contentType: "text/javascript",
      body: `window.google={accounts:{oauth2:{initTokenClient(options){return{requestAccessToken(){options.error_callback({type:"popup_failed_to_open"});}};}}}};`
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "התחברות לחשבון מורשה" }).click();

  await expect(page.getByText("חלון Google נחסם על ידי הדפדפן. יש לאפשר חלונות קופצים לאתר ולנסות שוב.")).toBeVisible();
});

test("settings remain readable and operable on the configured viewport", async ({ page, isMobile }) => {
  await page.goto("/#/settings");

  await expect(page.getByLabel("חשבונות Google מורשים")).toBeVisible();
  await expect(page.getByLabel("מזהה התחברות")).toBeVisible();
  const connectButton = page.getByRole("button", { name: "התחברות לאחסון" });
  await expect(connectButton).toBeVisible();

  if (isMobile) {
    const buttonBox = await connectButton.boundingBox();
    expect(buttonBox?.height || 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
