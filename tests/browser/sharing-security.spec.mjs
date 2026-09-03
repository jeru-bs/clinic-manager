import { expect, test } from "@playwright/test";
import { setupUiMocks } from "./helpers/ui-mocks.mjs";

// The mocked account (azaidman1@gmail.com) is in the config.js allowlist; the root folder id
// comes from the mock's localStorage config ("root-folder").
const CONFIG_CLIENT_ID = "1015803685955-e2bholm6s2l2thqrh15ktbqqf7flng5n.apps.googleusercontent.com";

test("a share to a user outside the allowlist is reported as a warning and never deleted", async ({ page }) => {
  const { captured } = await setupUiMocks(page, {
    drive: {
      permissions: {
        "root-folder": [
          { id: "perm-owner", type: "user", role: "owner", emailAddress: "azaidman1@gmail.com" },
          { id: "perm-spouse", type: "user", role: "writer", emailAddress: "malki.frankel@gmail.com" },
          { id: "perm-stranger", type: "user", role: "reader", emailAddress: "stranger@example.com" },
          { id: "perm-domain", type: "domain", role: "reader", domain: "example.org" }
        ]
      }
    }
  });

  await page.goto("/#/settings");

  const warnings = page.locator("[data-sharing-warning]");
  await expect(warnings).toHaveCount(2);
  await expect(warnings.first()).toContainText("תיקיית הקליניקה");
  await expect(warnings.first()).toContainText("שאינו ברשימת המורשים");
  await expect(warnings.first()).toContainText("stranger@example.com");
  await expect(warnings.nth(1)).toContainText("לכל הדומיין example.org");
  await expect(page.locator(".security-report .health-summary")).toContainText("דורשות בדיקה ידנית");
  expect(captured.permissionDeletes).toEqual([]);
});

test("a publicly shared file inside a clinic sub-folder loses its public permission on load", async ({ page }) => {
  const { captured } = await setupUiMocks(page, {
    drive: {
      publicFiles: [
        { id: "public-file", name: "סיכום.pdf", parents: ["sub-folder"] },
        { id: "unrelated-file", name: "personal.jpg", parents: ["other-folder"] }
      ],
      parents: { "sub-folder": ["root-folder"], "other-folder": ["personal-root"] },
      permissions: {
        "public-file": [
          { id: "perm-owner", type: "user", role: "owner", emailAddress: "azaidman1@gmail.com" },
          { id: "perm-anyone", type: "anyone", role: "reader" }
        ],
        "unrelated-file": [{ id: "perm-anyone-2", type: "anyone", role: "reader" }]
      }
    }
  });

  await page.goto("/#/settings");

  await expect(page.getByText("הוסרו 1 הרשאות שיתוף ציבוריות ממשאבי הקליניקה.")).toBeVisible();
  expect(captured.permissionDeletes).toEqual([{ fileId: "public-file", permissionId: "perm-anyone" }]);
  expect(captured.driveQueries.some((query) => query.includes("visibility = 'anyoneWithLink'"))).toBe(true);
  await expect(page.locator(".security-report")).toContainText("סיכום.pdf");
  await expect(page.locator(".security-report .health-summary")).toContainText("אין הרשאות ציבוריות");
});

test("googleClientId cannot be overridden from localStorage or the shared settings file", async ({ page }) => {
  await setupUiMocks(page, {
    drive: {
      settings: {
        googleClientId: "remote-attacker.apps.googleusercontent.com",
        googleSpreadsheetId: "remote-sheet",
        appName: "מרחוק"
      }
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "clinic-manager-config",
      JSON.stringify({ googleClientId: "local-attacker.apps.googleusercontent.com", googleDriveRootFolderId: "root-folder" })
    );
  });

  await page.goto("/#/settings");

  await expect(page.locator("#activeGoogleClientId")).toHaveValue(CONFIG_CLIENT_ID);
  await expect(page.locator("#googleClientId")).toHaveValue(CONFIG_CLIENT_ID);
  await expect(page.locator("#googleClientId")).toHaveAttribute("readonly", "");
  // Whitelisted keys from the shared settings file are still applied.
  await expect(page.locator("#googleSpreadsheetId")).toHaveValue("remote-sheet");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("clinic-manager-config") || "{}"));
  expect(stored.googleClientId).toBeUndefined();
  expect(stored.googleSpreadsheetId).toBe("remote-sheet");
});

test("the page renders without Content Security Policy violations, including the time picker", async ({ page }) => {
  const violations = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  await setupUiMocks(page, {
    seed: {
      patients: [
        ["p1", "מטופל", "", "בית ספר", "רגשי", "300", "", "", "", "", "", "active", "cash", "unpaid", "not_needed", "folder-p1", "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z", "", ""]
      ]
    }
  });

  await page.goto("/#/calendar");
  await expect(page.locator(".calendar-page, .calendar, main").first()).toBeVisible();
  await page.goto("/#/patients/p1");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-action="profile-tab"][data-tab="documentation"]').first().click();
  await expect(page.locator('form[data-form="session"]')).toBeVisible();
  const timeInput = page.locator("#start_time");
  await timeInput.scrollIntoViewIfNeeded();
  await timeInput.click();
  const hourButton = page.locator(".time-popover [data-picker-hour='9']");
  await expect(hourButton).toBeVisible();
  const position = await hourButton.evaluate((element) => ({
    x: element.style.getPropertyValue("--x"),
    left: getComputedStyle(element).left
  }));
  expect(position.x).toMatch(/%$/);
  expect(position.left).not.toBe("auto");
  await page.goto("/#/settings");
  await expect(page.locator("#activeGoogleClientId")).toHaveValue(/apps.googleusercontent.com$/);
  expect(violations).toEqual([]);
});
