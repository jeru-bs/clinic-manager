import { expect, test } from "@playwright/test";

const SHEET_HEADERS = {
  patients: ["id", "child_name", "address", "school_name", "treatment_type", "fixed_price", "fixed_day", "fixed_time", "treatment_goals", "sensitive_notes", "general_notes", "status", "default_payment_method", "payment_status", "receipt_status", "drive_folder_id", "drive_folder_path", "created_at", "updated_at", "fixed_start_date", "fixed_end_date"],
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

// One Drive+Sheets mock harness per test: an in-memory folder tree, resumable
// uploads, business_records rows and captured writes for assertions.
async function setupBusinessMocks(page, { businessRows = [], failBusinessAppend = false } = {}) {
  const captured = {
    folderCreates: [],
    folderQueries: [],
    uploadMetadata: [],
    appendedBusinessRows: [],
    filePatches: [],
    businessRowPuts: [],
    clearedBusinessRanges: []
  };
  const folderStore = new Map();
  let folderSequence = 0;
  let uploadSequence = 0;
  let pendingUploadName = "";
  const rows = businessRows.map((row) => [...row]);

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

  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    if (decoded.includes("fields=sheets.properties.title")) {
      return route.fulfill({ json: { sheets: Object.keys(SHEET_HEADERS).map((title) => ({ properties: { title } })) } });
    }
    const headerEntry = Object.entries(SHEET_HEADERS).find(([sheet]) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [headerEntry[1]] } });
    if (decoded.includes("business_records!A:L:append")) {
      if (failBusinessAppend) {
        return route.fulfill({ status: 500, json: { error: { message: "backend write failure" } } });
      }
      const values = request.postDataJSON()?.values || [];
      captured.appendedBusinessRows.push(...values);
      rows.push(...values.map((row) => [...row]));
      return route.fulfill({ json: { updates: { updatedRange: `business_records!A${rows.length + 1}:L${rows.length + 1}` } } });
    }
    const rowMatch = decoded.match(/business_records!A(\d+):L(\d+)/);
    if (rowMatch && request.method() === "GET") {
      const row = rows[Number(rowMatch[1]) - 2];
      return route.fulfill({ json: { values: row ? [row] : [] } });
    }
    if (rowMatch && request.method() === "PUT") {
      const values = request.postDataJSON()?.values || [];
      captured.businessRowPuts.push({ range: rowMatch[0], row: values[0] || [] });
      if (values[0]) rows[Number(rowMatch[1]) - 2] = [...values[0]];
      return route.fulfill({ json: {} });
    }
    if (rowMatch && decoded.includes(":clear")) {
      captured.clearedBusinessRanges.push(rowMatch[0]);
      rows[Number(rowMatch[1]) - 2] = SHEET_HEADERS.business_records.map(() => "");
      return route.fulfill({ json: {} });
    }
    if (request.method() === "GET" && decoded.includes("business_records!A2:L")) {
      return route.fulfill({ json: { values: rows } });
    }
    if (request.method() === "GET" && decoded.includes("values/")) {
      return route.fulfill({ json: { values: [] } });
    }
    if (decoded.includes(":append")) {
      return route.fulfill({ json: { updates: { updatedRange: "audit_log!A2:J2" } } });
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
    if (decoded.includes("/upload/mock-session") && request.method() === "PUT") {
      uploadSequence += 1;
      const id = `file-${uploadSequence}`;
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { id, name: pendingUploadName, webViewLink: `https://drive.google.com/${id}` }
      });
    }
    if (decoded.includes("/upload/drive/v3/files") && request.method() === "POST") {
      const metadata = request.postDataJSON() || {};
      captured.uploadMetadata.push(metadata);
      pendingUploadName = metadata.name || "";
      return route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, Location: "https://www.googleapis.com/upload/mock-session" },
        body: ""
      });
    }
    if (decoded.includes("/drive/v3/files/") && request.method() === "PATCH") {
      const fileId = decoded.match(/\/drive\/v3\/files\/([^?]+)/)?.[1] || "";
      captured.filePatches.push({
        fileId,
        body: request.postDataJSON() || {},
        addParents: decoded.match(/addParents=([^&]+)/)?.[1] || "",
        removeParents: decoded.match(/removeParents=([^&]+)/)?.[1] || ""
      });
      return route.fulfill({ json: { id: fileId } });
    }
    const folderQuery = request.method() === "GET" ? new URL(request.url()).searchParams.get("q") || "" : "";
    if (decoded.includes("/drive/v3/files") && folderQuery.startsWith("name = ")) {
      const [, name, parent] = folderQuery.match(/name = '([^']+)' and '([^']+)' in parents/) || [];
      captured.folderQueries.push({ name, parent });
      const existing = folderStore.get(`${parent}|${name}`);
      return route.fulfill({ json: { files: existing ? [{ id: existing, name }] : [] } });
    }
    if (decoded.includes("/drive/v3/files") && request.method() === "POST") {
      const body = request.postDataJSON() || {};
      folderSequence += 1;
      const id = `folder-${folderSequence}`;
      folderStore.set(`${body.parents?.[0]}|${body.name}`, id);
      captured.folderCreates.push({ name: body.name, parent: body.parents?.[0] || "" });
      return route.fulfill({ json: { id, name: body.name } });
    }
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ json: { files: [] } });
    return route.fulfill({ json: {} });
  });

  return captured;
}

function seededRecordRow() {
  return [
    "b1",
    "2026-07-15",
    "income",
    "150.50",
    "file-1",
    "period-folder-old",
    "receipt.pdf",
    "https://drive.google.com/file-1",
    "manual",
    "",
    "2026-07-15T10:00:00.000Z",
    "2026-07-15T10:00:00.000Z"
  ];
}

async function setDateInput(page, selector, value) {
  await page.evaluate(
    ([inputSelector, dateValue]) => {
      document.querySelector(inputSelector).value = dateValue;
    },
    [selector, value]
  );
}

// המתנה לסיום הטעינה הראשונית של הנתונים, כדי שה-render שאחריה לא יאפס קלט שכבר הוקלד בטופס.
async function openApp(page, route) {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

test("uploading business documents creates the period folder tree once and stores exact records", async ({ page }) => {
  const captured = await setupBusinessMocks(page);

  await openApp(page, "/");
  await page.getByRole("link", { name: "ניהול עסק" }).click();
  await expect(page.getByRole("heading", { name: "ניהול עסק" })).toBeVisible();
  await expect(page.getByText("אין רשומות בתקופה שנבחרה", { exact: false })).toBeVisible();

  await expect(page.locator("#business_document_date")).toHaveCount(0);
  await page.getByRole("button", { name: "רשומה עסקית חדשה +" }).click();
  await setDateInput(page, "#business_document_date", "2026-07-15");
  await page.getByLabel("סוג").selectOption("income");
  await page.getByLabel("סכום בשקלים").fill("150.5");
  await page.setInputFiles("#business_document", {
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock receipt")
  });
  await page.getByRole("button", { name: "העלאה ושמירה" }).click();
  await expect(page.getByText("המסמך הועלה והרשומה נשמרה.")).toBeVisible();

  expect(captured.folderCreates).toEqual([
    { name: "ניהול עסק", parent: "root-folder" },
    { name: "2026", parent: "folder-1" },
    { name: "יולי - אוגוסט", parent: "folder-2" }
  ]);
  expect(captured.uploadMetadata).toEqual([{ name: "receipt.pdf", parents: ["folder-3"] }]);
  expect(captured.appendedBusinessRows).toHaveLength(1);
  const [, documentDate, recordType, amount, driveFileId, driveFolderId, fileName, fileUrl, source, paymentId] =
    captured.appendedBusinessRows[0];
  expect([documentDate, recordType, amount, driveFileId, driveFolderId, fileName, fileUrl, source, paymentId]).toEqual([
    "2026-07-15",
    "income",
    "150.50",
    "file-1",
    "folder-3",
    "receipt.pdf",
    "https://drive.google.com/file-1",
    "manual",
    ""
  ]);
  await expect(page.locator(".teal-card strong").first()).toContainText("150.50");
  await expect(page.getByRole("cell", { name: "receipt.pdf" })).toBeVisible();

  // A second document in the same period must reuse the existing folders.
  await page.getByRole("button", { name: "רשומה עסקית חדשה +" }).click();
  await setDateInput(page, "#business_document_date", "2026-08-02");
  await page.getByLabel("סוג").selectOption("expense");
  await page.getByLabel("סכום בשקלים").fill("50.25");
  await page.setInputFiles("#business_document", {
    name: "invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock invoice")
  });
  await page.getByRole("button", { name: "העלאה ושמירה" }).click();
  await expect(page.getByRole("cell", { name: "invoice.pdf" })).toBeVisible();

  expect(captured.folderCreates).toHaveLength(3);
  expect(captured.uploadMetadata[1]).toEqual({ name: "invoice.pdf", parents: ["folder-3"] });
  await expect(page.locator(".pink-card strong").first()).toContainText("50.25");
  await expect(page.locator(".blue-card strong").first()).toContainText("100.25");

  // The custom inclusive range summary is computed on screen only.
  await setDateInput(page, "#business_range_start", "2026-07-15");
  await setDateInput(page, "#business_range_end", "2026-08-02");
  await page.getByRole("button", { name: "חישוב סיכום" }).click();
  await expect(page.getByText("נמצאו 2 רשומות")).toBeVisible();
});

test("a failed record save moves the uploaded file to the trash and reports the failure", async ({ page }) => {
  const captured = await setupBusinessMocks(page, { failBusinessAppend: true });

  await openApp(page, "/#/business");
  await expect(page.getByRole("heading", { name: "ניהול עסק" })).toBeVisible();
  await page.getByRole("button", { name: "רשומה עסקית חדשה +" }).click();
  await expect(page.locator("#business_document_date")).toBeAttached();
  await setDateInput(page, "#business_document_date", "2026-07-15");
  await page.getByLabel("סוג").selectOption("income");
  await page.getByLabel("סכום בשקלים").fill("80");
  await page.setInputFiles("#business_document", {
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 mock receipt")
  });
  await page.getByRole("button", { name: "העלאה ושמירה" }).click();

  await expect(page.getByText("הקובץ שהועלה הועבר לאשפה", { exact: false })).toBeVisible();
  expect(captured.filePatches).toEqual([{ fileId: "file-1", body: { trashed: true }, addParents: "", removeParents: "" }]);
  await expect(page.getByText("אין רשומות בתקופה שנבחרה", { exact: false })).toBeVisible();
});

test("moving a record's date to another period moves the Drive file and updates the row", async ({ page }) => {
  const captured = await setupBusinessMocks(page, { businessRows: [seededRecordRow()] });

  await openApp(page, "/#/business");
  await expect(page.getByRole("cell", { name: "receipt.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "עריכה" }).click();
  await expect(page.getByRole("button", { name: "עדכון רשומה" })).toBeVisible();

  await setDateInput(page, "#business_document_date", "2026-09-10");
  await page.getByLabel("סכום בשקלים").fill("175.25");
  await page.getByRole("button", { name: "עדכון רשומה" }).click();
  await expect(page.getByText("רשומת העסק עודכנה.")).toBeVisible();

  expect(captured.folderCreates).toEqual([
    { name: "ניהול עסק", parent: "root-folder" },
    { name: "2026", parent: "folder-1" },
    { name: "ספטמבר - אוקטובר", parent: "folder-2" }
  ]);
  const moves = captured.filePatches.filter((patch) => patch.addParents);
  expect(moves).toEqual([{ fileId: "file-1", body: {}, addParents: "folder-3", removeParents: "period-folder-old" }]);
  expect(captured.businessRowPuts).toHaveLength(1);
  const updatedRow = captured.businessRowPuts[0].row;
  expect(updatedRow[1]).toBe("2026-09-10");
  expect(updatedRow[3]).toBe("175.25");
  expect(updatedRow[5]).toBe("folder-3");
  await expect(page.getByRole("heading", { name: /ספטמבר - אוקטובר/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "receipt.pdf" })).toBeVisible();
});

test("deleting a record requires confirmation, trashes the file and clears the row", async ({ page }) => {
  const captured = await setupBusinessMocks(page, { businessRows: [seededRecordRow()] });
  const dialogMessages = [];
  page.on("dialog", (dialog) => {
    dialogMessages.push(dialog.message());
    dialog.accept();
  });

  await openApp(page, "/#/business");
  await expect(page.getByRole("cell", { name: "receipt.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "מחיקה" }).click();

  await expect(page.getByText("הרשומה נמחקה וקובץ המסמך הועבר לאשפה.")).toBeVisible();
  expect(dialogMessages).toHaveLength(1);
  expect(dialogMessages[0]).toContain("קובץ המסמך יועבר לאשפה");
  expect(captured.filePatches).toEqual([{ fileId: "file-1", body: { trashed: true }, addParents: "", removeParents: "" }]);
  expect(captured.clearedBusinessRanges).toEqual(["business_records!A2:L2"]);
  await expect(page.getByText("אין רשומות בתקופה שנבחרה", { exact: false })).toBeVisible();
});
