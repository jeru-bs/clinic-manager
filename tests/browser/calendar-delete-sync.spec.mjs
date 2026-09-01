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

const SYNC_QUEUE_KEY = "clinic-manager-sync-queue-v1";

function columnLetter(count) {
  let letter = "";
  let remaining = count;
  while (remaining > 0) {
    letter = String.fromCharCode(65 + ((remaining - 1) % 26)) + letter;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letter;
}

// Sheets mock plus a scripted Calendar DELETE endpoint: each delete call consumes
// the next status from deleteStatuses (empty list means success), so retry
// behavior can be driven deterministically. queuedItems pre-seeds the
// localStorage sync queue exactly as a stuck production browser would hold it.
async function setupCalendarMocks(page, { seed = {}, deleteStatuses = [], queuedItems = [] } = {}) {
  const store = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, (seed[sheet] || []).map((row) => [...row])])
  );
  const captured = { clears: [], calendarDeletes: [] };
  const pendingStatuses = [...deleteStatuses];

  await page.addInitScript(
    ({ queueKey, items }) => {
      sessionStorage.setItem(
        "clinic-manager-google-token",
        JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
      );
      localStorage.setItem("clinic-manager-config", JSON.stringify({ googleDriveRootFolderId: "root-folder" }));
      localStorage.setItem("clinic-manager-calendar-privacy-v1", "queued");
      if (items.length) localStorage.setItem(queueKey, JSON.stringify(items));
    },
    { queueKey: SYNC_QUEUE_KEY, items: queuedItems }
  );
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
    if (decoded.includes("/calendar/v3/") && decoded.includes("/events/") && request.method() === "DELETE") {
      const status = pendingStatuses.length ? pendingStatuses.shift() : 204;
      captured.calendarDeletes.push({ url: decoded, status });
      if (status === 204) return route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      return route.fulfill({
        status,
        headers: CORS_HEADERS,
        json: { error: { code: status, message: status === 410 ? "Resource has been deleted" : "backend failure" } }
      });
    }
    if (decoded.includes("/calendar/v3/")) {
      return route.fulfill({ headers: CORS_HEADERS, json: { id: "calendar-event-1" } });
    }
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ headers: CORS_HEADERS, json: { files: [] } });
    return route.fulfill({ headers: CORS_HEADERS, json: {} });
  });

  return { captured, store };
}

function patientRow(id, name) {
  return [id, name, "", "בית ספר", "רגשי", "300", "", "", "", "", "", "active", "cash", "unpaid", "not_needed", `folder-${id}`, "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z", "", ""];
}

function sessionRow(id, patientId, date, eventId) {
  return [id, patientId, date, "10:00", "10:45", "קליניקה", "טיפול", "מפגש מתועד", "", eventId, `${date}T08:00:00.000Z`, `${date}T08:00:00.000Z`, ""];
}

function queuedCalendarDelete(eventId) {
  return {
    id: `queued-${eventId}`,
    kind: "calendar_delete",
    entityId: `deleted-session-${eventId}`,
    payload: { eventId },
    attempts: 4,
    nextAttemptAt: 0,
    lastError: "שירות Google אינו זמין זמנית.",
    createdAt: "2026-08-20T08:00:00.000Z",
    updatedAt: "2026-08-20T08:00:00.000Z"
  };
}

function readSyncQueue(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), SYNC_QUEUE_KEY);
}

async function deleteFirstSession(page) {
  await page.goto("/#/patients/p1");
  await page.locator(".profile-tab", { hasText: "תיעוד מפגש" }).click();
  await page.locator(".list-item", { hasText: "מפגש מתועד" }).getByRole("button", { name: "מחיקה" }).click();
}

test("deleting a session removes its calendar event directly without queueing work", async ({ page }) => {
  const { captured } = await setupCalendarMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")], sessions: [sessionRow("s1", "p1", "2026-08-03", "calendar-event-1")] }
  });
  page.on("dialog", (dialog) => dialog.accept());

  await deleteFirstSession(page);
  await expect(page.getByText("המפגש נמחק מהמערכת ומהיומן.")).toBeVisible();
  expect(captured.calendarDeletes).toHaveLength(1);
  expect(captured.calendarDeletes[0].url).toContain("calendar-event-1");
  expect(captured.clears).toEqual(expect.arrayContaining([{ sheet: "sessions", range: "sessions!A2:O2" }]));
  expect(await readSyncQueue(page)).toHaveLength(0);
  await expect(page.locator("#syncStatus")).not.toContainText("ממתינות לסנכרון");
});

test("a temporary calendar failure still deletes the session and queues the event deletion", async ({ page }) => {
  const { captured } = await setupCalendarMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")], sessions: [sessionRow("s1", "p1", "2026-08-03", "calendar-event-1")] },
    deleteStatuses: [500, 500, 500]
  });
  page.on("dialog", (dialog) => dialog.accept());

  await deleteFirstSession(page);
  await expect(page.getByText("מחיקת האירוע מהיומן ממתינה לסנכרון חוזר", { exact: false })).toBeVisible();
  expect(captured.clears).toEqual(expect.arrayContaining([{ sheet: "sessions", range: "sessions!A2:O2" }]));

  const queue = await readSyncQueue(page);
  expect(queue).toHaveLength(1);
  expect(queue[0].kind).toBe("calendar_delete");
  expect(queue[0].payload.eventId).toBe("calendar-event-1");
  await expect(page.locator("#syncStatus")).toContainText("1 פעולות ממתינות לסנכרון");
});

test("a retry that returns 404 counts as success and clears the queued deletion", async ({ page }) => {
  const { captured } = await setupCalendarMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")], sessions: [sessionRow("s1", "p1", "2026-08-03", "calendar-event-1")] },
    deleteStatuses: [500, 404]
  });
  page.on("dialog", (dialog) => dialog.accept());

  await deleteFirstSession(page);
  await expect(page.locator("#syncStatus")).toContainText("1 פעולות ממתינות לסנכרון");
  expect(await readSyncQueue(page)).toHaveLength(1);

  await page.locator('button[data-action="retry-sync"]').click();
  await expect(page.getByText("כל הפעולות הסתנכרנו.")).toBeVisible();
  expect(captured.calendarDeletes.map((entry) => entry.status)).toEqual([500, 404]);
  expect(await readSyncQueue(page)).toHaveLength(0);
  await expect(page.locator("#syncStatus")).not.toContainText("ממתינות לסנכרון");
});

test("a stored stuck deletion clears automatically when the retry returns 410", async ({ page }) => {
  const { captured } = await setupCalendarMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")] },
    deleteStatuses: [410],
    queuedItems: [queuedCalendarDelete("ghost-event-1")]
  });

  await page.goto("/#/patients/p1");
  await expect.poll(() => readSyncQueue(page)).toHaveLength(0);
  expect(captured.calendarDeletes).toHaveLength(1);
  expect(captured.calendarDeletes[0].url).toContain("ghost-event-1");
  expect(captured.calendarDeletes[0].status).toBe(410);
  await expect(page.locator("#syncStatus")).not.toContainText("ממתינות לסנכרון");
});

test("genuine retryable errors keep the deletion queued for another attempt", async ({ page }) => {
  const { captured } = await setupCalendarMocks(page, {
    seed: { patients: [patientRow("p1", "נועם")] },
    deleteStatuses: [500, 429, 500, 500, 500],
    queuedItems: [queuedCalendarDelete("ghost-event-1")]
  });

  await page.goto("/#/patients/p1");
  await expect.poll(() => captured.calendarDeletes.length).toBeGreaterThan(0);
  expect(await readSyncQueue(page)).toHaveLength(1);
  await expect(page.locator("#syncStatus")).toContainText("1 פעולות ממתינות לסנכרון");

  await page.locator('button[data-action="retry-sync"]').click();
  await expect(page.getByText("חלק מהפעולות עדיין ממתינות", { exact: false })).toBeVisible();
  const queue = await readSyncQueue(page);
  expect(queue).toHaveLength(1);
  expect(queue[0].payload.eventId).toBe("ghost-event-1");
  expect(queue[0].attempts).toBeGreaterThan(4);
});
