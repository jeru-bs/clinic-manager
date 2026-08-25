import { expect, test } from "@playwright/test";

const SHEET_HEADERS = {
  patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at"],
  sessions: ["id", "patient_id", "session_date", "start_time", "end_time", "location", "session_type", "summary", "sensitive_notes", "calendar_event_id", "created_at", "updated_at", "document_file_id"],
  payments: ["id", "patient_id", "session_id", "amount", "payment_method", "payment_status", "receipt_status", "paid_at", "receipt_file_id", "notes", "created_at", "updated_at"],
  tasks: ["id", "patient_id", "title", "description", "status", "due_date", "source", "created_at", "updated_at", "reminder_at"],
  files: ["id", "patient_id", "drive_file_id", "drive_folder_id", "name", "file_type", "url", "created_at", "updated_at"],
  contacts: ["id", "patient_id", "contact_type", "name", "relationship", "phone", "email", "organization", "notes", "created_at", "updated_at"],
  goals: ["id", "patient_id", "title", "description", "status", "progress", "target_date", "note", "legacy_source", "created_at", "updated_at"],
  goal_updates: ["id", "goal_id", "patient_id", "session_id", "progress", "status", "note", "created_at", "updated_at"],
  questionnaire_templates: ["id", "name", "audience", "questions_json", "active", "created_at", "updated_at"],
  questionnaire_assignments: ["id", "patient_id", "contact_id", "template_id", "form_id", "responder_url", "status", "sent_at", "due_date", "responded_at", "last_response_id", "created_at", "updated_at"],
  questionnaire_responses: ["id", "assignment_id", "patient_id", "contact_id", "response_id", "submitted_at", "answers_json", "reviewed_at", "created_at", "updated_at"],
  clinical_reports: ["id", "patient_id", "report_type", "title", "period_start", "period_end", "content", "document_file_id", "pdf_file_id", "created_at", "updated_at"],
  schedule_exceptions: ["id", "patient_id", "exception_type", "start_date", "end_date", "reason", "created_at", "updated_at"],
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

// Sheets + Drive mock: an in-memory row store per sheet, a lazy Drive folder
// registry, and captured writes (appends/puts/clears/copies/trashes/moves) so
// every business artifact can be asserted exactly.
async function setupIncomeMocks(page, { seed = {}, queuedItems = null, failBusinessAppendTimes = 0 } = {}) {
  const store = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, (seed[sheet] || []).map((row) => [...row])])
  );
  const captured = { appends: [], puts: [], clears: [], copies: [], trashes: [], untrashes: [], moves: [], folderCreates: [], uploads: [] };
  const folders = new Map();
  const uploadNames = new Map();
  let uploadSequence = 0;
  let copySequence = 0;
  let folderSequence = 0;
  let businessAppendFailuresLeft = failBusinessAppendTimes;

  await page.addInitScript((queued) => {
    sessionStorage.setItem(
      "clinic-manager-google-token",
      JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
    );
    localStorage.setItem("clinic-manager-config", JSON.stringify({ googleDriveRootFolderId: "root-folder" }));
    localStorage.setItem("clinic-manager-calendar-privacy-v1", "queued");
    if (queued) {
      const now = new Date().toISOString();
      localStorage.setItem(
        "clinic-manager-sync-queue-v1",
        JSON.stringify(
          queued.map((item, index) => ({
            id: `queued-${index + 1}`,
            attempts: 1,
            nextAttemptAt: Date.now() + 10 * 60 * 1000,
            lastError: "שגיאת רשת",
            createdAt: now,
            updatedAt: now,
            ...item
          }))
        )
      );
    }
  }, queuedItems);
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
      if (sheet === "business_records" && businessAppendFailuresLeft > 0) {
        businessAppendFailuresLeft -= 1;
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
    if (decoded.includes("/permissions")) return route.fulfill({ headers: CORS_HEADERS, json: { permissions: [] } });
    if (decoded.includes("/calendar/v3/")) {
      return route.fulfill({ headers: CORS_HEADERS, json: { id: "calendar-event-1" } });
    }
    if (decoded.includes("uploadType=resumable") && request.method() === "POST") {
      uploadSequence += 1;
      const metadata = request.postDataJSON() || {};
      uploadNames.set(String(uploadSequence), { name: metadata.name || "", parent: metadata.parents?.[0] || "" });
      return route.fulfill({
        headers: { ...CORS_HEADERS, Location: `https://www.googleapis.com/upload-session/${uploadSequence}` },
        json: {}
      });
    }
    const sessionMatch = decoded.match(/\/upload-session\/(\d+)/);
    if (sessionMatch && request.method() === "PUT") {
      const info = uploadNames.get(sessionMatch[1]) || { name: "", parent: "" };
      const fileId = `receipt-upload-${sessionMatch[1]}`;
      captured.uploads.push({ id: fileId, name: info.name, parent: info.parent });
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { id: fileId, name: info.name, webViewLink: `https://drive.google.com/${fileId}` }
      });
    }
    const copyMatch = decoded.match(/\/drive\/v3\/files\/([\w-]+)\/copy/);
    if (copyMatch && request.method() === "POST") {
      copySequence += 1;
      const body = request.postDataJSON() || {};
      const copyId = `biz-copy-new-${copySequence}`;
      captured.copies.push({ sourceId: copyMatch[1], id: copyId, name: body.name || "", parent: body.parents?.[0] || "" });
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { id: copyId, name: body.name || "", webViewLink: `https://drive.google.com/${copyId}` }
      });
    }
    const fileMatch = decoded.match(/\/drive\/v3\/files\/([\w-]+)(\?|$)/);
    if (fileMatch && request.method() === "PATCH") {
      if (decoded.includes("addParents=")) {
        captured.moves.push({
          fileId: fileMatch[1],
          addParents: decoded.match(/addParents=([\w-]+)/)?.[1] || "",
          removeParents: decoded.match(/removeParents=([\w-]+)/)?.[1] || ""
        });
      } else {
        const body = request.postDataJSON() || {};
        if (body.trashed === true) captured.trashes.push(fileMatch[1]);
        if (body.trashed === false) captured.untrashes.push(fileMatch[1]);
      }
      return route.fulfill({ headers: CORS_HEADERS, json: { id: fileMatch[1] } });
    }
    if (decoded.includes("/drive/v3/files?") && request.method() === "GET" && decoded.includes("in parents")) {
      const name = decoded.match(/name = '([^']+)'/)?.[1] || "";
      const parent = decoded.match(/'([\w-]+)' in parents/)?.[1] || "";
      const existingId = folders.get(`${parent}::${name}`);
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { files: existingId ? [{ id: existingId, name }] : [] }
      });
    }
    if (decoded.includes("/drive/v3/files") && request.method() === "POST") {
      const body = request.postDataJSON() || {};
      if (body.mimeType === "application/vnd.google-apps.folder") {
        folderSequence += 1;
        const folderId = `bizfolder-${folderSequence}`;
        folders.set(`${body.parents?.[0] || ""}::${body.name || ""}`, folderId);
        captured.folderCreates.push({ id: folderId, name: body.name || "", parent: body.parents?.[0] || "" });
        return route.fulfill({ headers: CORS_HEADERS, json: { id: folderId, name: body.name || "" } });
      }
      return route.fulfill({ headers: CORS_HEADERS, json: { id: "doc-1", name: body.name || "", webViewLink: "https://drive.google.com/doc-1" } });
    }
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ headers: CORS_HEADERS, json: { files: [] } });
    return route.fulfill({ headers: CORS_HEADERS, json: {} });
  });

  return { captured, store };
}

const TS = "2026-08-01T08:00:00.000Z";

function patientRow(id, name) {
  return [id, name, "", "בית ספר", "רגשי", "300", "", "", "", "", "", "active", "cash", "unpaid", "not_needed", `folder-${id}`, "", TS, TS];
}

function chargeRow(id, sessionId, patientId, date, amount) {
  return [id, sessionId, patientId, date, amount, `${date}T09:00:00.000Z`, `${date}T09:00:00.000Z`];
}

function paymentRow(id, patientId, amount, paidAt, receiptFileId) {
  return [id, patientId, "", amount, "cash", "paid", receiptFileId ? "issued" : "needed", paidAt, receiptFileId || "", "", TS, TS];
}

function fileRow(id, patientId, driveFileId, name) {
  return [id, patientId, driveFileId, `folder-${patientId}`, name, "receipt", `https://drive.google.com/${driveFileId}`, TS, TS];
}

function businessIncomeRow(id, date, amount, driveFileId, folderId, paymentId) {
  return [id, date, "income", amount, driveFileId, folderId, "קבלה.pdf", `https://drive.google.com/${driveFileId}`, "payment", paymentId, TS, TS];
}

function appendsFor(captured, sheet) {
  return captured.appends.filter((entry) => entry.sheet === sheet);
}

function putsFor(captured, sheet) {
  return captured.puts.filter((entry) => entry.sheet === sheet);
}

function clearsFor(captured, sheet) {
  return captured.clears.filter((entry) => entry.sheet === sheet);
}

const LINKED_SEED = {
  patients: [patientRow("p1", "נועם")],
  payments: [paymentRow("pay1", "p1", "400", "2026-08-25", "receipt-drive-1")],
  files: [fileRow("f1", "p1", "receipt-drive-1", "קבלה.pdf")],
  business_records: [businessIncomeRow("biz1", "2026-08-25", "400.00", "biz-copy-1", "period-folder-old", "pay1")]
};

async function openPaymentsTab(page) {
  await page.goto("/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "תשלומים" }).click();
}

async function setPaidAt(form, value) {
  await form.locator("#paid_at").evaluate((el, next) => {
    el.value = next;
  }, value);
}

test("saving a payment with a receipt creates the period copy and one linked income row", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, {
    seed: {
      patients: [patientRow("p1", "נועם")],
      session_charges: [
        chargeRow("c1", "s1", "p1", "2026-08-03", "300.00"),
        chargeRow("c2", "s2", "p1", "2026-08-10", "300.00")
      ]
    }
  });

  await openPaymentsTab(page);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator('input[name="charge_ids"][value="c1"]').check();
  await paymentForm.locator('input[name="charge_ids"][value="c2"]').check();
  await paymentForm.locator("#amount").fill("400");
  await setPaidAt(paymentForm, "2026-08-25");
  await paymentForm.locator("#receipt_upload").setInputFiles({
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF-DATA")
  });
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();

  // The original receipt lands in the patient folder and stays there.
  expect(captured.uploads).toEqual([{ id: "receipt-upload-1", name: "receipt.pdf", parent: "folder-p1" }]);
  expect(captured.trashes).toEqual([]);

  // The business copy is a real file copy inside ניהול עסק/2026/יולי - אוגוסט.
  expect(captured.folderCreates.map((folder) => [folder.name, folder.parent])).toEqual([
    ["ניהול עסק", "root-folder"],
    ["2026", "bizfolder-1"],
    ["יולי - אוגוסט", "bizfolder-2"]
  ]);
  expect(captured.copies).toEqual([
    { sourceId: "receipt-upload-1", id: "biz-copy-new-1", name: "receipt.pdf", parent: "bizfolder-3" }
  ]);

  // Exactly one linked income row with the actual (partial) payment amount.
  const paymentAppends = appendsFor(captured, "payments");
  expect(paymentAppends).toHaveLength(1);
  const paymentId = paymentAppends[0].row[0];
  const businessAppends = appendsFor(captured, "business_records");
  expect(businessAppends).toHaveLength(1);
  const [, documentDate, recordType, amount, driveFileId, driveFolderId, fileName, , source, linkedPaymentId] = businessAppends[0].row;
  expect(documentDate).toBe("2026-08-25");
  expect(recordType).toBe("income");
  expect(amount).toBe("400.00");
  expect(driveFileId).toBe("biz-copy-new-1");
  expect(driveFolderId).toBe("bizfolder-3");
  expect(fileName).toBe("receipt.pdf");
  expect(source).toBe("payment");
  expect(linkedPaymentId).toBe(paymentId);
});

test("re-saving an unchanged payment never duplicates the income row or the copy", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, { seed: LINKED_SEED });

  await openPaymentsTab(page);
  await page.locator('button[data-action="edit-payment"][data-id="pay1"]').click();
  const paymentForm = page.locator('form[data-form="payment"][data-id="pay1"]');
  await expect(paymentForm.locator("#amount")).toHaveValue("400");
  await paymentForm.getByRole("button", { name: "עדכון תשלום" }).click();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();

  expect(appendsFor(captured, "business_records")).toHaveLength(0);
  expect(putsFor(captured, "business_records")).toHaveLength(0);
  expect(captured.copies).toEqual([]);
  expect(captured.trashes).toEqual([]);
  expect(captured.moves).toEqual([]);
  expect(putsFor(captured, "payments")).toHaveLength(1);
});

test("changing the amount and date updates the income row and moves the copy to the new period", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, { seed: LINKED_SEED });

  await openPaymentsTab(page);
  await page.locator('button[data-action="edit-payment"][data-id="pay1"]').click();
  const paymentForm = page.locator('form[data-form="payment"][data-id="pay1"]');
  await paymentForm.locator("#amount").fill("350");
  await setPaidAt(paymentForm, "2026-09-15");
  await paymentForm.getByRole("button", { name: "עדכון תשלום" }).click();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();

  expect(captured.folderCreates.map((folder) => folder.name)).toEqual(["ניהול עסק", "2026", "ספטמבר - אוקטובר"]);
  expect(captured.moves).toEqual([
    { fileId: "biz-copy-1", addParents: "bizfolder-3", removeParents: "period-folder-old" }
  ]);
  expect(captured.copies).toEqual([]);
  expect(captured.trashes).toEqual([]);
  expect(appendsFor(captured, "business_records")).toHaveLength(0);
  const businessPuts = putsFor(captured, "business_records");
  expect(businessPuts).toHaveLength(1);
  expect(businessPuts[0].row[1]).toBe("2026-09-15");
  expect(businessPuts[0].row[3]).toBe("350.00");
  expect(businessPuts[0].row[4]).toBe("biz-copy-1");
  expect(businessPuts[0].row[5]).toBe("bizfolder-3");
  expect(businessPuts[0].row[9]).toBe("pay1");
});

test("replacing the receipt creates a new business copy and trashes the old one", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, { seed: LINKED_SEED });

  await openPaymentsTab(page);
  await page.locator('button[data-action="edit-payment"][data-id="pay1"]').click();
  const paymentForm = page.locator('form[data-form="payment"][data-id="pay1"]');
  await paymentForm.locator("#receipt_upload").setInputFiles({
    name: "receipt2.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF-DATA-2")
  });
  await paymentForm.getByRole("button", { name: "עדכון תשלום" }).click();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();

  expect(captured.uploads).toEqual([{ id: "receipt-upload-1", name: "receipt2.pdf", parent: "folder-p1" }]);
  // The new copy goes to the same period folder without recreating folders.
  expect(captured.folderCreates).toEqual([]);
  expect(captured.copies).toEqual([
    { sourceId: "receipt-upload-1", id: "biz-copy-new-1", name: "receipt2.pdf", parent: "period-folder-old" }
  ]);
  const businessPuts = putsFor(captured, "business_records");
  expect(businessPuts).toHaveLength(1);
  expect(businessPuts[0].row[4]).toBe("biz-copy-new-1");
  expect(businessPuts[0].row[6]).toBe("receipt2.pdf");
  // The old patient receipt and the old business copy are both trashed; no rows duplicated.
  expect(captured.trashes).toContain("receipt-drive-1");
  expect(captured.trashes).toContain("biz-copy-1");
  expect(appendsFor(captured, "business_records")).toHaveLength(0);
});

test("deleting the payment deletes the linked income row and trashes the business copy", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, { seed: LINKED_SEED });
  page.on("dialog", (dialog) => dialog.accept());

  await openPaymentsTab(page);
  await page.locator('button[data-action="delete-payment"][data-id="pay1"]').click();
  await expect(page.getByText("התשלום נמחק מהמערכת.")).toBeVisible();

  expect(captured.trashes).toContain("biz-copy-1");
  expect(captured.trashes).toContain("receipt-drive-1");
  expect(clearsFor(captured, "business_records")).toHaveLength(1);
  expect(clearsFor(captured, "payments")).toHaveLength(1);
  expect(captured.untrashes).toEqual([]);
});

test("deleting only the patient-card receipt keeps the income row and the business copy", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, { seed: LINKED_SEED });
  page.on("dialog", (dialog) => dialog.accept());

  await openPaymentsTab(page);
  await page.locator('button[data-action="delete-payment-receipt"][data-id="pay1"]').click();
  await expect(page.getByText("קובץ הקבלה נמחק ועודכן ברשומת התשלום.")).toBeVisible();

  expect(captured.trashes).toContain("receipt-drive-1");
  expect(captured.trashes).not.toContain("biz-copy-1");
  expect(clearsFor(captured, "business_records")).toHaveLength(0);
  expect(putsFor(captured, "business_records")).toHaveLength(0);
  const paymentPuts = putsFor(captured, "payments");
  expect(paymentPuts.some((entry) => entry.row[8] === "")).toBe(true);
});

test("a failed income append trashes the copy, keeps the payment, and re-save syncs cleanly", async ({ page }) => {
  const { captured } = await setupIncomeMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")] },
    failBusinessAppendTimes: 1
  });

  await openPaymentsTab(page);
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator("#amount").fill("200");
  await setPaidAt(paymentForm, "2026-08-25");
  await paymentForm.locator("#receipt_upload").setInputFiles({
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF-DATA")
  });
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();

  // Clear Hebrew error, the payment is kept, and the orphan copy is trashed.
  await expect(page.getByText("התשלום נשמר, אך סנכרון רשומת ההכנסה בניהול העסק נכשל", { exact: false })).toBeVisible();
  expect(appendsFor(captured, "payments")).toHaveLength(1);
  expect(clearsFor(captured, "payments")).toHaveLength(0);
  expect(appendsFor(captured, "business_records")).toHaveLength(0);
  expect(captured.copies).toHaveLength(1);
  expect(captured.trashes).toContain("biz-copy-new-1");

  // The status indicator must stay visible while the error stands.
  await page.waitForTimeout(6000);
  await expect(page.locator("#syncStatus")).toBeVisible();
  await expect(page.locator("[data-sync-label]")).toHaveText("לא נשמר");

  // Re-saving the payment retries the sync and creates exactly one income row.
  const paymentId = appendsFor(captured, "payments")[0].row[0];
  await page.locator(`button[data-action="edit-payment"][data-id="${paymentId}"]`).click();
  await page.locator(`form[data-form="payment"][data-id="${paymentId}"]`).getByRole("button", { name: "עדכון תשלום" }).click();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();
  const businessAppends = appendsFor(captured, "business_records");
  expect(businessAppends).toHaveLength(1);
  expect(businessAppends[0].row[9]).toBe(paymentId);
  expect(captured.copies).toHaveLength(2);
});

test("the saved indicator hides five seconds after success and returns with new activity", async ({ page }) => {
  await setupIncomeMocks(page, { seed: { patients: [patientRow("p1", "נועם")] } });

  await openPaymentsTab(page);
  await expect(page.locator("#syncStatus")).toBeVisible();
  await expect(page.locator("#syncStatus")).toBeHidden({ timeout: 8000 });

  // A new save shows the indicator again immediately, then it hides after success.
  await page.getByRole("button", { name: "תשלום חדש +" }).click();
  const paymentForm = page.locator('form[data-form="payment"]');
  await paymentForm.locator("#amount").fill("100");
  await paymentForm.getByRole("button", { name: "שמירת תשלום" }).click();
  await expect(page.locator("#syncStatus")).toBeVisible();
  await expect(page.getByText("התשלום נשמר במערכת.")).toBeVisible();
  await expect(page.locator("[data-sync-label]")).toHaveText("נשמר");
  await expect(page.locator("#syncStatus")).toBeHidden({ timeout: 8000 });
});

test("the indicator stays visible while sync work is pending", async ({ page }) => {
  await setupIncomeMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")] },
    queuedItems: [{ kind: "calendar_delete", entityId: "old-session", payload: { calendarEventId: "event-1" } }]
  });

  await page.goto("/#/patients/p1");
  await expect(page.locator("[data-sync-label]")).toHaveText("1 פעולות ממתינות לסנכרון");
  await page.waitForTimeout(6000);
  await expect(page.locator("#syncStatus")).toBeVisible();
  await expect(page.locator("[data-sync-label]")).toHaveText("1 פעולות ממתינות לסנכרון");
});
