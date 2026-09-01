import { expect, test } from "@playwright/test";

const SHEET_HEADERS = {
  patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at", "fixed_start_date", "fixed_end_date"],
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Content-Range, X-Upload-Content-Type, X-Upload-Content-Length",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Location, Range"
};

function columnLetter(count) {
  let letter = "";
  let remaining = count;
  while (remaining > 0) {
    letter = String.fromCharCode(65 + ((remaining - 1) % 26)) + letter;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letter;
}

// Same in-memory Sheets/Drive mock shape used by the financial specs: no real Google calls.
async function setupUiMocks(page, { seed = {} } = {}) {
  const store = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, (seed[sheet] || []).map((row) => [...row])])
  );
  const captured = { appends: [], puts: [], clears: [] };

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "clinic-manager-google-token",
      JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
    );
    localStorage.setItem("clinic-manager-config", JSON.stringify({ googleDriveRootFolderId: "root-folder" }));
  });
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.google={accounts:{oauth2:{}}};" })
  );
  await page.route("https://www.hebcal.com/**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("https://docs.googleapis.com/**", (route) => route.fulfill({ json: {} }));

  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    if (decoded.includes("fields=sheets.properties.title")) {
      return route.fulfill({ json: { sheets: Object.keys(SHEET_HEADERS).map((title) => ({ properties: { title } })) } });
    }
    const headerEntry = Object.entries(SHEET_HEADERS).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [headerEntry[1]] } });
    const sheet = decoded.match(/values\/([a-z_]+)!/)?.[1];
    if (!sheet || !store[sheet]) return route.fulfill({ json: {} });
    const rows = store[sheet];
    const lastColumn = columnLetter(SHEET_HEADERS[sheet].length);
    if (decoded.includes(`${sheet}!A:${lastColumn}:append`)) {
      const values = request.postDataJSON()?.values || [];
      captured.appends.push(...values.map((row) => ({ sheet, row: [...row] })));
      rows.push(...values.map((row) => [...row]));
      return route.fulfill({
        json: { updates: { updatedRange: `${sheet}!A${rows.length + 1}:${lastColumn}${rows.length + 1}` } }
      });
    }
    const rowMatch = decoded.match(new RegExp(`${sheet}!A(\\d+):${lastColumn}(\\d+)`));
    if (rowMatch && decoded.includes(":clear")) {
      captured.clears.push({ sheet, range: rowMatch[0] });
      rows[Number(rowMatch[1]) - 2] = SHEET_HEADERS[sheet].map(() => "");
      return route.fulfill({ json: {} });
    }
    if (rowMatch && request.method() === "PUT") {
      const values = request.postDataJSON()?.values || [];
      captured.puts.push({ sheet, range: rowMatch[0], row: values[0] || [] });
      if (values[0]) rows[Number(rowMatch[1]) - 2] = [...values[0]];
      return route.fulfill({ json: {} });
    }
    if (rowMatch && request.method() === "GET") {
      const row = rows[Number(rowMatch[1]) - 2];
      return route.fulfill({ json: { values: row ? [row] : [] } });
    }
    if (request.method() === "GET" && decoded.includes(`${sheet}!A2:${lastColumn}`)) {
      return route.fulfill({ json: { values: rows } });
    }
    return route.fulfill({ json: {} });
  });

  await page.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
    if (decoded.includes("/oauth2/v3/userinfo")) {
      return route.fulfill({ json: { email: "azaidman1@gmail.com", name: "אהרן", email_verified: true } });
    }
    if (decoded.includes("/permissions")) return route.fulfill({ json: { permissions: [] } });
    if (decoded.includes("/calendar/v3/")) return route.fulfill({ headers: CORS_HEADERS, json: { id: "calendar-event-1" } });
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ headers: CORS_HEADERS, json: { files: [] } });
    return route.fulfill({ headers: CORS_HEADERS, json: {} });
  });

  return { captured, store };
}

function patientRow(id, name, fixedPrice) {
  return [id, name, "", "בית ספר", "רגשי", fixedPrice, "שני", "10:00", "", "", "", "active", "cash", "unpaid", "not_needed", `folder-${id}`, "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z", "2026-01-01", "2026-12-31"];
}

function sessionRow(id, patientId, date, summary) {
  return [id, patientId, date, "10:00", "10:45", "קליניקה", "טיפול", summary, "", "calendar-event-1", `${date}T08:00:00.000Z`, `${date}T08:00:00.000Z`, ""];
}

function chargeRow(id, sessionId, patientId, date, amount) {
  return [id, sessionId, patientId, date, amount, `${date}T09:00:00.000Z`, `${date}T09:00:00.000Z`];
}

const SEED = {
  patients: [patientRow("p1", "נועם", "300")],
  sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
  session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
};

// המתנה לסיום הטעינה הראשונית של הנתונים, כדי שה-render שאחריה לא יאפס קלט שכבר הוקלד בטופס.
async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

test("the payment form opens only on request and stays open when validation fails", async ({ page }) => {
  const { captured } = await setupUiMocks(page, { seed: SEED });

  await openApp(page, "/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();

  const toggle = page.getByRole("button", { name: "תשלום חדש +" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('form[data-form="payment"]')).toHaveCount(0);

  await toggle.click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await expect(paymentForm).toBeVisible();
  await expect(page.getByRole("button", { name: "סגירת הטופס" })).toHaveAttribute("aria-expanded", "true");

  // A rejected amount keeps the form open with the inline error and writes nothing.
  await paymentForm.locator('input[name="charge_ids"][value="c1"]').check();
  await paymentForm.locator("#amount").fill("500");
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();
  await expect(page.getByText("גבוה מסך היתרה הפתוחה", { exact: false })).toBeVisible();
  await expect(paymentForm).toBeVisible();
  expect(captured.appends.filter((entry) => entry.sheet === "payments")).toHaveLength(0);

  // Closing the form by hand hides it again without saving anything.
  await page.getByRole("button", { name: "סגירת הטופס" }).click();
  await expect(page.locator('form[data-form="payment"]')).toHaveCount(0);
  expect(captured.appends.filter((entry) => entry.sheet === "payments")).toHaveLength(0);
});

test("a successful save closes the disclosure form again", async ({ page }) => {
  const { captured } = await setupUiMocks(page, { seed: SEED });

  await openApp(page, "/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "משימות" }).click();
  await expect(page.locator('form[data-form="task"]')).toHaveCount(0);

  await page.getByRole("button", { name: "משימה חדשה +" }).click();
  await page.locator("#task_title").fill("לשלוח סיכום להורה");
  await page.getByRole("button", { name: "שמירת משימה" }).click();
  await expect(page.getByText("המשימה נשמרה במערכת.")).toBeVisible();

  expect(captured.appends.filter((entry) => entry.sheet === "tasks")).toHaveLength(1);
  await expect(page.locator('form[data-form="task"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "משימה חדשה +" })).toBeVisible();
});

test("the Hebrew upload control reports the selected file name", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });

  await openApp(page, "/#/business");
  await page.getByRole("button", { name: "רשומה עסקית חדשה +" }).click();

  const fileName = page.locator('[data-upload-name="business_document"]');
  await expect(fileName).toHaveText("לא נבחר קובץ");
  await expect(page.locator("#business_document")).toHaveAttribute("required", "");

  await page.setInputFiles("#business_document", {
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock receipt")
  });
  await expect(fileName).toHaveText("receipt.pdf");
});

test("dismissing the status message never clears input the user already typed", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });

  await openApp(page, "/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "משימות" }).click();
  await page.getByRole("button", { name: "משימה חדשה +" }).click();
  await page.locator("#task_title").fill("משימה ראשונה");
  await page.getByRole("button", { name: "שמירת משימה" }).click();

  const message = page.locator("[data-app-message]");
  await expect(message).toBeVisible();

  await page.getByRole("button", { name: "משימה חדשה +" }).click();
  await page.locator("#task_title").fill("טיוטה שעדיין לא נשמרה");

  // ההודעה נעלמת אחרי 4.5 שניות; הטופס הפתוח והקלט שבתוכו חייבים לשרוד.
  await expect(message).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('form[data-form="task"]')).toBeVisible();
  await expect(page.locator("#task_title")).toHaveValue("טיוטה שעדיין לא נשמרה");
});

test("the patient card shows a persistent summary and keeps every tab reachable", async ({ page }) => {
  await setupUiMocks(page, { seed: SEED });

  await openApp(page, "/#/patients/p1");
  const summary = page.locator(".patient-summary");
  await expect(summary.getByRole("heading", { name: "נועם" })).toBeVisible();
  await expect(summary).toContainText("יתרת חוב");
  await expect(summary).toContainText("300.00");
  await expect(summary.getByRole("button", { name: "עריכת פרטי מטופל" })).toBeVisible();

  for (const tab of ["פרטים", "תיעוד מפגש", "מטרות", "תשלומים", "קבצים", "הורים ואנשי מקצוע", "שאלונים", "דוחות טיפוליים", "משימות"]) {
    await page.locator(".profile-tab", { hasText: tab }).click();
    await expect(page.locator(".profile-tab.active")).toHaveText(tab);
  }
});
