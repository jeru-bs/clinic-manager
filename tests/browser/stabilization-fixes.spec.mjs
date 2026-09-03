import { expect, test } from "@playwright/test";
import { batchGetJson, sheetPropertiesJson } from "./helpers/ui-mocks.mjs";

const SHEET_HEADERS = {
  patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at", "fixed_start_date", "fixed_end_date", "no_show_policy", "no_show_fee"],
  sessions: ["id", "patient_id", "session_date", "start_time", "end_time", "location", "session_type", "summary", "sensitive_notes", "calendar_event_id", "created_at", "updated_at", "document_file_id", "next_plan", "status"],
  payments: ["id", "patient_id", "session_id", "amount", "payment_method", "payment_status", "receipt_status", "paid_at", "receipt_file_id", "notes", "created_at", "updated_at"],
  tasks: ["id", "patient_id", "title", "description", "status", "due_date", "source", "created_at", "updated_at", "reminder_at", "task_key"],
  files: ["id", "patient_id", "drive_file_id", "drive_folder_id", "name", "file_type", "url", "created_at", "updated_at"],
  contacts: ["id", "patient_id", "contact_type", "name", "relationship", "phone", "email", "organization", "notes", "created_at", "updated_at"],
  goals: ["id", "patient_id", "title", "description", "status", "progress", "target_date", "note", "legacy_source", "created_at", "updated_at"],
  goal_updates: ["id", "goal_id", "patient_id", "session_id", "progress", "status", "note", "created_at", "updated_at", "outcome"],
  questionnaire_templates: ["id", "name", "audience", "questions_json", "active", "created_at", "updated_at"],
  questionnaire_assignments: ["id", "patient_id", "contact_id", "template_id", "form_id", "responder_url", "status", "sent_at", "due_date", "responded_at", "last_response_id", "created_at", "updated_at"],
  questionnaire_responses: ["id", "assignment_id", "patient_id", "contact_id", "response_id", "submitted_at", "answers_json", "reviewed_at", "created_at", "updated_at"],
  clinical_reports: ["id", "patient_id", "report_type", "title", "period_start", "period_end", "content", "document_file_id", "pdf_file_id", "created_at", "updated_at"],
  schedule_exceptions: ["id", "patient_id", "exception_type", "start_date", "end_date", "reason", "created_at", "updated_at", "moved_to_date", "moved_to_time"],
  business_records: ["id", "document_date", "record_type", "amount", "drive_file_id", "drive_folder_id", "file_name", "file_url", "source", "payment_id", "created_at", "updated_at"],
  session_charges: ["id", "session_id", "patient_id", "session_date", "amount", "created_at", "updated_at"],
  payment_allocations: ["id", "payment_id", "charge_id", "session_id", "patient_id", "amount", "created_at", "updated_at"],
  audit_log: ["id", "action_type", "entity_type", "entity_id", "summary", "actor_email", "mutations_json", "undoable", "undone_at", "created_at"]
};

test("a default email removed from the saved allowlist stays removed after reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "clinic-manager-config",
      JSON.stringify({ allowedUserEmails: "kept.user@example.com" })
    );
  });

  await page.goto("/#/settings");
  await expect(page.getByLabel("חשבונות Google מורשים")).toHaveValue("kept.user@example.com");

  await page.reload();
  await expect(page.getByLabel("חשבונות Google מורשים")).toHaveValue("kept.user@example.com");
});

test("a mismatched sheet header is reported without any write to the sheet", async ({ page }) => {
  const sheetWrites = [];

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
    if (request.method() !== "GET") {
      sheetWrites.push(`${request.method()} ${decoded}`);
      return route.fulfill({ json: {} });
    }
    if (decoded.includes("fields=sheets.properties")) {
      return route.fulfill({ json: sheetPropertiesJson(Object.keys(SHEET_HEADERS)) });
    }
    if (decoded.includes("/values:batchGet")) {
      return route.fulfill({
        json: batchGetJson(request, (range) => {
          const [sheet, cells] = range.split("!");
          if (cells === "1:1") return sheet === "patients" ? [["id", "child_name", "status"]] : [SHEET_HEADERS[sheet]];
          return [];
        })
      });
    }
    const headerEntry = Object.entries(SHEET_HEADERS).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) {
      const [sheet, header] = headerEntry;
      const values = sheet === "patients" ? [["id", "child_name", "status"]] : [header];
      return route.fulfill({ json: { values } });
    }
    return route.fulfill({ json: { values: [] } });
  });
  await page.route("https://www.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/oauth2/v3/userinfo")) {
      return route.fulfill({ json: { email: "azaidman1@gmail.com", name: "בדיקה", email_verified: true } });
    }
    if (url.includes("/permissions")) return route.fulfill({ json: { permissions: [] } });
    if (url.includes("/drive/v3/files")) return route.fulfill({ json: { files: [] } });
    return route.fulfill({ json: {} });
  });

  await page.goto("/");

  await expect(page.getByText("מבנה מאגר הנתונים לא תקין")).toBeVisible();
  expect(sheetWrites).toEqual([]);
});

test("a synchronous connection failure renders an error message", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.google={accounts:{oauth2:{initTokenClient(){return{requestAccessToken(){throw new Error("sync-connect-failure");}};}}}};`
    })
  );

  await page.goto("/");
  await page.getByRole("button", { name: "התחברות לחשבון מורשה" }).click();

  await expect(page.getByText("sync-connect-failure")).toBeVisible();
});
