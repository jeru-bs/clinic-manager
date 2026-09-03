import { expect, test } from "@playwright/test";
import { batchGetJson, sheetPropertiesJson } from "./helpers/ui-mocks.mjs";
import { openRowMenu } from "./helpers/row-menu.mjs";

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

// One generic Sheets mock per test: an in-memory row store for every sheet plus
// captured appends/puts/clears so financial writes can be asserted exactly.
async function setupChargeMocks(page, { seed = {}, failAllocationAppend = false, failChargeRowWrite = false } = {}) {
  const store = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, (seed[sheet] || []).map((row) => [...row])])
  );
  const captured = { appends: [], puts: [], clears: [] };
  let documentSequence = 0;

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
    if (decoded.includes("fields=sheets.properties")) {
      return route.fulfill({ json: sheetPropertiesJson(Object.keys(SHEET_HEADERS)) });
    }
    if (decoded.includes("/values:batchGet")) {
      return route.fulfill({
        json: batchGetJson(request, (range) => {
          const [sheet, cells] = range.split("!");
          if (cells === "1:1") return [SHEET_HEADERS[sheet]];
          return store[sheet] || [];
        })
      });
    }
    const headerEntry = Object.entries(SHEET_HEADERS).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [headerEntry[1]] } });
    const sheet = decoded.match(/values\/([a-z_]+)!/)?.[1];
    if (!sheet || !store[sheet]) return route.fulfill({ json: {} });
    const rows = store[sheet];
    const lastColumn = columnLetter(SHEET_HEADERS[sheet].length);
    if (decoded.includes(`${sheet}!A:${lastColumn}:append`)) {
      if (failAllocationAppend && sheet === "payment_allocations") {
        return route.fulfill({ status: 500, json: { error: { message: "backend write failure" } } });
      }
      const values = request.postDataJSON()?.values || [];
      captured.appends.push(...values.map((row) => ({ sheet, row: [...row] })));
      rows.push(...values.map((row) => [...row]));
      return route.fulfill({
        json: { updates: { updatedRange: `${sheet}!A${rows.length + 1}:${lastColumn}${rows.length + 1}` } }
      });
    }
    const rowMatch = decoded.match(new RegExp(`${sheet}!A(\\d+):${lastColumn}(\\d+)`));
    if (
      rowMatch &&
      failChargeRowWrite &&
      sheet === "session_charges" &&
      (decoded.includes(":clear") || request.method() === "PUT")
    ) {
      return route.fulfill({ status: 500, json: { error: { message: "backend write failure" } } });
    }
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
    if (decoded.includes("/calendar/v3/")) {
      return route.fulfill({ headers: CORS_HEADERS, json: { id: "calendar-event-1" } });
    }
    if (decoded.includes("/drive/v3/files") && request.method() === "POST") {
      documentSequence += 1;
      const body = request.postDataJSON() || {};
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { id: `doc-${documentSequence}`, name: body.name || "", webViewLink: `https://drive.google.com/doc-${documentSequence}` }
      });
    }
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ headers: CORS_HEADERS, json: { files: [] } });
    return route.fulfill({ headers: CORS_HEADERS, json: {} });
  });

  return { captured, store };
}

function patientRow(id, name, fixedPrice) {
  return [id, name, "", "בית ספר", "רגשי", fixedPrice, "", "", "", "", "", "active", "cash", "unpaid", "not_needed", `folder-${id}`, "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z", "", ""];
}

function sessionRow(id, patientId, date, summary) {
  return [id, patientId, date, "10:00", "10:45", "קליניקה", "טיפול", summary, "", "calendar-event-1", `${date}T08:00:00.000Z`, `${date}T08:00:00.000Z`, ""];
}

function chargeRow(id, sessionId, patientId, date, amount) {
  return [id, sessionId, patientId, date, amount, `${date}T09:00:00.000Z`, `${date}T09:00:00.000Z`];
}

function appendsFor(captured, sheet) {
  return captured.appends.filter((entry) => entry.sheet === sheet);
}

async function openProfileTab(page, patientId, tabLabel) {
  await page.goto(`/#/patients/${patientId}`);
  await page.locator(".profile-tab", { hasText: tabLabel }).click();
}

test("saving a treatment report creates exactly one charge with the fixed-price snapshot", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, { seed: { patients: [patientRow("p1", "נועם", "300")] } });

  await openProfileTab(page, "p1", "תיעוד מפגש");
  await page.locator("#summary").fill("תיעוד טיפול ראשון");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
  await expect(page.locator(".list-item", { hasText: "תיעוד טיפול ראשון" })).toBeVisible();

  const chargeAppends = appendsFor(captured, "session_charges");
  expect(chargeAppends).toHaveLength(1);
  const [, chargeSessionId, chargePatientId, , chargeAmount] = chargeAppends[0].row;
  expect(chargePatientId).toBe("p1");
  expect(chargeSessionId).toBe(appendsFor(captured, "sessions")[0].row[0]);
  expect(chargeAmount).toBe("300.00");

  // Re-saving the same session must not create a second charge.
  await page.locator(".list-item", { hasText: "תיעוד טיפול ראשון" }).getByRole("button", { name: "עריכה" }).click();
  await expect(page.locator("#summary")).toHaveValue("תיעוד טיפול ראשון");
  await page.locator("#summary").fill("תיעוד טיפול ראשון - עדכון");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  await expect(page.locator(".list-item", { hasText: "תיעוד טיפול ראשון - עדכון" })).toBeVisible();
  expect(appendsFor(captured, "session_charges")).toHaveLength(1);

  // The new charge is open in the patient card and in the global payments page.
  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  const chargeRows = page.locator(".profile-tab-body .table-wrap tbody tr");
  await expect(chargeRows).toHaveCount(1);
  await expect(chargeRows.first().locator(".status-pill")).toHaveText("פתוח");

  await page.goto("/#/payments");
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  const openChargesPanel = page.locator("section.panel", { hasText: "חיובים פתוחים" });
  await expect(openChargesPanel.locator("tbody tr", { hasText: "נועם" })).toHaveCount(1);
});

test("a report without a valid fixed price is blocked while plain scheduling stays possible", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, { seed: { patients: [patientRow("p2", "תמר", "")] } });

  await openProfileTab(page, "p2", "תיעוד מפגש");
  await page.locator("#summary").fill("תיעוד ללא מחיר קבוע");
  await page.getByRole("button", { name: "שמירת מפגש" }).click();

  await expect(page.getByText("לא הוגדר מחיר טיפול קבוע תקין למטופל", { exact: false })).toBeVisible();
  expect(appendsFor(captured, "sessions")).toHaveLength(0);
  expect(appendsFor(captured, "session_charges")).toHaveLength(0);

  // Scheduling without documentation must still save and must not charge.
  await page.getByRole("button", { name: "שמירת מפגש" }).click();
  await expect(page.locator(".list-item", { hasText: "לא נכתב סיכום." })).toBeVisible();
  expect(appendsFor(captured, "sessions")).toHaveLength(1);
  expect(appendsFor(captured, "session_charges")).toHaveLength(0);
});

test("a multi-session payment allocates oldest-first and rejects overpayment", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [
        sessionRow("s1", "p1", "2026-08-03", "מפגש ראשון"),
        sessionRow("s2", "p1", "2026-08-10", "מפגש שני"),
        sessionRow("s3", "p1", "2026-08-17", "מפגש שלישי")
      ],
      session_charges: [
        chargeRow("c1", "s1", "p1", "2026-08-03", "300.00"),
        chargeRow("c2", "s2", "p1", "2026-08-10", "300.00"),
        chargeRow("c3", "s3", "p1", "2026-08-17", "300.00")
      ]
    }
  });

  await openProfileTab(page, "p1", "תשלומים");
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("900.00");

  await expect(page.locator('form[data-form="payment"]')).toHaveCount(0);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator('input[name="charge_ids"][value="c1"]').check();
  await paymentForm.locator('input[name="charge_ids"][value="c2"]').check();
  await paymentForm.locator('input[name="charge_ids"][value="c3"]').check();
  await expect(paymentForm.locator("#amount")).toHaveValue("900.00");
  await paymentForm.locator("#amount").fill("400");
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();

  await expect(page.locator(".status-pill", { hasText: "שולם חלקית" })).toBeVisible();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("500.00");
  const chargeStatusRows = page.locator(".profile-tab-body .table-wrap tbody tr");
  await expect(chargeStatusRows.nth(0).locator(".status-pill")).toHaveText("שולם");
  await expect(chargeStatusRows.nth(1).locator(".status-pill")).toHaveText("שולם חלקית");
  await expect(chargeStatusRows.nth(2).locator(".status-pill")).toHaveText("פתוח");

  const paymentAppends = appendsFor(captured, "payments");
  expect(paymentAppends).toHaveLength(1);
  expect(paymentAppends[0].row[2]).toBe("");
  expect(paymentAppends[0].row[3]).toBe("400");
  const allocationAppends = appendsFor(captured, "payment_allocations");
  expect(allocationAppends.map((entry) => [entry.row[2], entry.row[5]])).toEqual([
    ["c1", "300.00"],
    ["c2", "100.00"]
  ]);

  // A fully paid charge cannot be selected again, and overpayment is rejected with no writes.
  await expect(page.locator('form[data-form="payment"]')).toHaveCount(0);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const nextForm = page.locator('form[data-form="payment"]');
  await expect(nextForm.locator('input[name="charge_ids"][value="c1"]')).toBeDisabled();
  await nextForm.locator('input[name="charge_ids"][value="c2"]').check();
  await nextForm.locator('input[name="charge_ids"][value="c3"]').check();
  await expect(nextForm.locator("#amount")).toHaveValue("500.00");
  await nextForm.locator("#amount").fill("600");
  await nextForm.getByRole("button", { name: "שמירת תשלום" }).click();
  await expect(page.getByText("גבוה מסך היתרה הפתוחה", { exact: false })).toBeVisible();
  expect(appendsFor(captured, "payments")).toHaveLength(1);
  expect(appendsFor(captured, "payment_allocations")).toHaveLength(2);
});

test("deleting a payment reopens its charges and charged sessions cannot be deleted", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")],
      payments: [["pay1", "p1", "s1", "300", "cash", "paid", "not_needed", "2026-08-04", "", "", "2026-08-04T10:00:00.000Z", "2026-08-04T10:00:00.000Z"]],
      payment_allocations: [["a1", "pay1", "c1", "s1", "p1", "300.00", "2026-08-04T10:00:00.000Z", "2026-08-04T10:00:00.000Z"]]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תיעוד מפגש");
  await page.locator(".list-item", { hasText: "מפגש מתועד" }).getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("אי אפשר למחוק מפגש שיש לו חיוב טיפול או תשלום משויך", { exact: false })).toBeVisible();
  expect(captured.clears.filter((entry) => entry.sheet === "sessions")).toHaveLength(0);

  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("0.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first().locator(".status-pill")).toHaveText("שולם");

  await (await openRowMenu(page.locator(".list-item", { hasText: "מזומן" }))).getByRole("menuitem", { name: "מחיקה" }).click();
  await expect(page.getByText("התשלום נמחק מהמערכת.")).toBeVisible();
  expect(captured.clears).toEqual(
    expect.arrayContaining([
      { sheet: "payment_allocations", range: "payment_allocations!A2:H2" },
      { sheet: "payments", range: "payments!A2:L2" }
    ])
  );
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first().locator(".status-pill")).toHaveText("פתוח");
});

test("editing an unpaid charge validates the amount and updates every balance", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תשלומים");
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  await page.locator('button[data-action="edit-charge"][data-id="c1"]').click();

  // Invalid amounts are rejected before any write.
  for (const invalidAmount of ["12.345", "0"]) {
    await page.locator("[data-charge-amount-input]").fill(invalidAmount);
    await page.locator('button[data-action="save-charge-amount"][data-id="c1"]').click();
    await expect(page.getByText("סכום החיוב אינו תקין", { exact: false })).toBeVisible();
    expect(captured.puts.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
  }

  await page.locator("[data-charge-amount-input]").fill("250");
  await page.locator('button[data-action="save-charge-amount"][data-id="c1"]').click();
  await expect(page.getByText("סכום החיוב עודכן.")).toBeVisible();
  const chargePuts = captured.puts.filter((entry) => entry.sheet === "session_charges");
  expect(chargePuts).toHaveLength(1);
  expect(chargePuts[0].row[4]).toBe("250.00");

  // Balances update everywhere; the patient's fixed price is untouched.
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("250.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first().locator(".status-pill")).toHaveText("פתוח");
  expect(captured.puts.filter((entry) => entry.sheet === "patients")).toHaveLength(0);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator('input[name="charge_ids"][value="c1"]').check();
  await expect(paymentForm.locator("#amount")).toHaveValue("250.00");
  await page.goto("/#/payments");
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("250.00");
});

test("cancelling an unpaid charge removes the debt and frees the session for deletion", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תשלומים");
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  await expect(page.locator('form[data-form="payment"] input[name="charge_ids"][value="c1"]')).toBeVisible();
  await page.locator('button[data-action="cancel-charge"][data-id="c1"]').click();
  await expect(page.getByText("חיוב הטיפול בוטל והוסר מהיתרות.")).toBeVisible();
  expect(captured.clears).toEqual(
    expect.arrayContaining([{ sheet: "session_charges", range: "session_charges!A2:G2" }])
  );
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("0.00");
  await expect(page.locator('form[data-form="payment"] input[name="charge_ids"]')).toHaveCount(0);

  // The treatment report is untouched and the session can now be deleted normally.
  expect(captured.puts.filter((entry) => entry.sheet === "sessions")).toHaveLength(0);
  await page.locator(".profile-tab", { hasText: "תיעוד מפגש" }).click();
  await expect(page.locator(".list-item", { hasText: "מפגש מתועד" })).toBeVisible();
  await page.locator(".list-item", { hasText: "מפגש מתועד" }).getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("המפגש נמחק", { exact: false })).toBeVisible();
  expect(captured.clears).toEqual(expect.arrayContaining([{ sheet: "sessions", range: "sessions!A2:O2" }]));
});

test("re-saving a report after cancellation creates one new charge at the current fixed price", async ({ page }) => {
  const { captured, store } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תשלומים");
  await page.locator('button[data-action="cancel-charge"][data-id="c1"]').click();
  await expect(page.getByText("חיוב הטיפול בוטל והוסר מהיתרות.")).toBeVisible();

  // The fixed price changes later; a deliberate re-save must charge the new price.
  store.patients[0][5] = "350";
  await page.reload();
  await page.locator(".profile-tab", { hasText: "תיעוד מפגש" }).click();
  await page.locator(".list-item", { hasText: "מפגש מתועד" }).getByRole("button", { name: "עריכה" }).click();
  await expect(page.locator("#summary")).toHaveValue("מפגש מתועד");
  await page.getByRole("button", { name: "עדכון מפגש" }).click();
  await expect(page.getByText("המפגש נשמר", { exact: false })).toBeVisible();

  const chargeAppends = appendsFor(captured, "session_charges");
  expect(chargeAppends).toHaveLength(1);
  expect(chargeAppends[0].row[1]).toBe("s1");
  expect(chargeAppends[0].row[4]).toBe("350.00");
  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("350.00");
});

test("charges with an allocation or a legacy linked payment cannot be edited or cancelled", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש ראשון"), sessionRow("s2", "p1", "2026-08-10", "מפגש שני")],
      session_charges: [
        chargeRow("c1", "s1", "p1", "2026-08-03", "300.00"),
        chargeRow("c2", "s2", "p1", "2026-08-10", "300.00")
      ],
      payments: [
        ["pay1", "p1", "s1", "100", "cash", "paid", "not_needed", "2026-08-04", "", "", "2026-08-04T10:00:00.000Z", "2026-08-04T10:00:00.000Z"],
        ["pay2", "p1", "s2", "300", "cash", "paid", "not_needed", "2026-08-11", "", "", "2026-08-11T10:00:00.000Z", "2026-08-11T10:00:00.000Z"]
      ],
      payment_allocations: [["a1", "pay1", "c1", "s1", "p1", "100.00", "2026-08-04T10:00:00.000Z", "2026-08-04T10:00:00.000Z"]]
    }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תשלומים");
  // c1 is partially paid through an allocation, c2 is covered by a legacy payment only.
  for (const chargeId of ["c1", "c2"]) {
    await page.locator(`button[data-action="edit-charge"][data-id="${chargeId}"]`).click();
    await expect(page.getByText("לחיוב זה משויך תשלום", { exact: false })).toBeVisible();
    await expect(page.locator("[data-charge-amount-input]")).toHaveCount(0);
    await page.locator(`button[data-action="cancel-charge"][data-id="${chargeId}"]`).click();
    await expect(page.getByText("לחיוב זה משויך תשלום", { exact: false })).toBeVisible();
  }
  expect(captured.puts.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
  expect(captured.clears.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
});

test("a failed charge write leaves the original charge and balances unchanged", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
    },
    failChargeRowWrite: true
  });
  page.on("dialog", (dialog) => dialog.accept());

  await openProfileTab(page, "p1", "תשלומים");
  await page.locator('button[data-action="edit-charge"][data-id="c1"]').click();
  await page.locator("[data-charge-amount-input]").fill("250");
  await page.locator('button[data-action="save-charge-amount"][data-id="c1"]').click();
  await expect(page.locator(".message.error")).toBeVisible();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");

  await page.locator('button[data-action="cancel-charge-edit"]').click();
  await page.locator('button[data-action="cancel-charge"][data-id="c1"]').click();
  await expect(page.locator(".message.error")).toBeVisible();
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  await expect(page.locator('form[data-form="payment"] input[name="charge_ids"][value="c1"]')).toBeVisible();
  expect(captured.puts.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
  expect(captured.clears.filter((entry) => entry.sheet === "session_charges")).toHaveLength(0);
});

test("a failed allocation write rolls the payment back with no partial records", async ({ page }) => {
  const { captured } = await setupChargeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם", "300")],
      sessions: [sessionRow("s1", "p1", "2026-08-03", "מפגש מתועד")],
      session_charges: [chargeRow("c1", "s1", "p1", "2026-08-03", "300.00")]
    },
    failAllocationAppend: true
  });

  await openProfileTab(page, "p1", "תשלומים");
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator('input[name="charge_ids"][value="c1"]').check();
  await expect(paymentForm.locator("#amount")).toHaveValue("300.00");
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();

  await expect(page.getByText("שמירת שיוך התשלום נכשלה והרשומות הוחזרו לאחור", { exact: false })).toBeVisible();
  expect(appendsFor(captured, "payments")).toHaveLength(1);
  expect(captured.clears.filter((entry) => entry.sheet === "payments")).toHaveLength(1);
  await expect(page.locator('[data-payments-total="open"] strong')).toContainText("300.00");
  await expect(page.locator(".profile-tab-body .table-wrap tbody tr").first().locator(".status-pill")).toHaveText("פתוח");
});
