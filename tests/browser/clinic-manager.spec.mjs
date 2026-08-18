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

test("the Israel calendar requests and caches Hebrew Hebcal holidays", async ({ page }) => {
  const year = new Date().getFullYear();
  let requestedUrl = "";
  await page.route("https://www.hebcal.com/hebcal?**", async (route) => {
    requestedUrl = route.request().url();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            date: `${year}-09-21`,
            category: "holiday",
            subcat: "major",
            hebrew: "יום כיפור",
            yomtov: true,
            link: "https://www.hebcal.com/"
          }
        ]
      })
    });
  });

  await page.goto("/#/calendar");

  await expect.poll(() => requestedUrl).toContain("i=on");
  expect(requestedUrl).toContain("lg=he");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), `clinic-manager-hebcal-israel-${year}`))
    .toContain("יום כיפור");
});

test("parents and professionals can be viewed and edited from the patient card", async ({ page }) => {
  const headers = {
    patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at"],
    sessions: ["id", "patient_id", "session_date", "start_time", "end_time", "location", "session_type", "summary", "sensitive_notes", "calendar_event_id", "created_at", "updated_at", "document_file_id"],
    payments: ["id", "patient_id", "session_id", "amount", "payment_method", "payment_status", "receipt_status", "paid_at", "receipt_file_id", "notes", "created_at", "updated_at"],
    tasks: ["id", "patient_id", "title", "description", "status", "due_date", "source", "created_at", "updated_at", "reminder_at"],
    files: ["id", "patient_id", "drive_file_id", "drive_folder_id", "name", "file_type", "url", "created_at", "updated_at"],
    contacts: ["id", "patient_id", "contact_type", "name", "relationship", "phone", "email", "organization", "notes", "created_at", "updated_at"],
    schedule_exceptions: ["id", "patient_id", "exception_type", "start_date", "end_date", "reason", "created_at", "updated_at"],
    audit_log: ["id", "action_type", "entity_type", "entity_id", "summary", "actor_email", "mutations_json", "undoable", "undone_at", "created_at"]
  };
  const patientRow = ["p1", "נועם", "", "בית ספר", "רגשי", "", "", "", "", "", "", "active", "bank_transfer", "unpaid", "needed", "folder1", "", "2026-01-01", "2026-01-01"];
  const contactRow = ["c1", "p1", "professional", "דנה כהן", "קלינאית תקשורת", "0501234567", "dana@example.com", "בית ספר", "לתיאום ישיר", "2026-01-01", "2026-01-01"];

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "clinic-manager-google-token",
      JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
    );
  });
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.google={accounts:{oauth2:{}}};" })
  );
  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    if (decoded.includes("fields=sheets.properties.title")) {
      return route.fulfill({ json: { sheets: Object.keys(headers).map((title) => ({ properties: { title } })) } });
    }
    const headerEntry = Object.entries(headers).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [headerEntry[1]] } });
    if (request.method() === "GET" && decoded.includes("patients!A2:")) {
      return route.fulfill({ json: { values: [patientRow] } });
    }
    if (request.method() === "GET" && decoded.includes("contacts!A2:")) {
      return route.fulfill({ json: { values: [contactRow] } });
    }
    if (request.method() === "GET" && decoded.includes("values/")) {
      return route.fulfill({ json: { values: [] } });
    }
    if (decoded.includes(":append")) {
      const sheet = decoded.match(/values\/([^!]+)!/)?.[1] || "audit_log";
      return route.fulfill({ json: { updates: { updatedRange: `${sheet}!A2:K2` } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route("https://www.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/oauth2/v3/userinfo")) {
      return route.fulfill({ json: { email: "azaidman1@gmail.com", name: "אהרן", email_verified: true } });
    }
    if (url.includes("/permissions")) return route.fulfill({ json: { permissions: [] } });
    if (url.includes("/drive/v3/files")) return route.fulfill({ json: { files: [] } });
    return route.fulfill({ json: {} });
  });

  await page.goto("/#/patients/p1");
  await page.getByRole("button", { name: "הורים ואנשי מקצוע" }).click();
  await expect(page.getByText("דנה כהן")).toBeVisible();
  await expect(page.getByRole("link", { name: "0501234567" })).toBeVisible();
  await page.getByRole("button", { name: "עריכה" }).click();
  await page.getByLabel("קרבה או תפקיד").fill("רכזת טיפול");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();
  await expect(page.getByText("פרטי איש הקשר עודכנו.")).toBeVisible();
});
