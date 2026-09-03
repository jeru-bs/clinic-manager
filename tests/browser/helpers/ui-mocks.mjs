// Shared in-memory Sheets/Drive mock: no production Google data is ever touched.

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

// Every sheet gets a stable numeric sheetId (its position + 1) so batchUpdate requests that
// address sheets by id can be mapped back to a title.
export function sheetPropertiesJson(titles, gridColumns = {}) {
  return {
    sheets: titles.map((title, index) => ({
      properties: { title, sheetId: index + 1, gridProperties: { columnCount: Number(gridColumns[title] || 26) } }
    }))
  };
}

// values:batchGet answers every requested range in request order.
export function batchGetJson(request, valuesFor) {
  const ranges = new URL(request.url()).searchParams.getAll("ranges");
  return { valueRanges: ranges.map((range) => ({ range, values: valuesFor(range) })) };
}

// Consumes one scripted failure: `{ match, status, times, headers }` where `match` is a URL
// substring or a predicate over (decodedUrl, request).
function scriptedFailure(failures, decoded, request) {
  const failure = failures.find(
    (item) =>
      Number(item.times ?? 1) > 0 &&
      (typeof item.match === "function" ? item.match(decoded, request) : decoded.includes(item.match || "")) &&
      (!item.method || item.method === request.method())
  );
  if (!failure) return null;
  failure.times = Number(failure.times ?? 1) - 1;
  return failure;
}

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
// `drive` seeds the sharing-security mock: `permissions[fileId]`, `publicFiles` (the files.list
// visibility query result), `parents[fileId]` for ancestry walks and `settings` (the remote
// clinic-manager-settings.json content).
// `sheetFailures` / `calendarFailures` script transient errors (see scriptedFailure) so retry
// paths can be exercised without touching real Google APIs.
// `calendarView` pins the stored calendar view (default month) so month-grid specs behave the
// same on mobile, where the app otherwise defaults to the day view; pass null to leave it unset.
export async function setupUiMocks(page, { seed = {}, headers = {}, gridColumns = {}, drive = {}, sheetFailures = [], calendarFailures = [], calendarView = "month" } = {}) {
  const drivePermissions = Object.fromEntries(
    Object.entries(drive.permissions || {}).map(([fileId, permissions]) => [fileId, permissions.map((item) => ({ ...item }))])
  );
  const publicFiles = (drive.publicFiles || []).map((file) => ({ ...file }));
  const driveParents = drive.parents || {};
  const store = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, (seed[sheet] || []).map((row) => [...row])])
  );
  // `headers` lets a spec start from a legacy header row so the automatic extension can be tested.
  const liveHeaders = Object.fromEntries(
    Object.entries(SHEET_HEADERS).map(([sheet, columns]) => [sheet, [...(headers[sheet] || columns)]])
  );
  // Google Sheets creates sheets 26 columns wide; a narrower grid must be widened before the
  // header can be extended.
  const liveGridColumns = Object.fromEntries(
    Object.keys(SHEET_HEADERS).map((sheet) => [sheet, Number(gridColumns[sheet] || 26)])
  );
  const captured = { appends: [], appendCalls: [], puts: [], columnPuts: [], clears: [], headerPuts: [], gridAppends: [], rowDeletes: [], documentInserts: [], calendar: [], permissionDeletes: [], driveQueries: [], driveFolders: [], sheetFailures: [], calendarFailures: [], batchGets: [] };

  await page.addInitScript((storedCalendarView) => {
    sessionStorage.setItem(
      "clinic-manager-google-token",
      JSON.stringify({ accessToken: "test-token", expiresAt: Date.now() + 60 * 60 * 1000 })
    );
    localStorage.setItem("clinic-manager-config", JSON.stringify({ googleDriveRootFolderId: "root-folder" }));
    if (storedCalendarView) localStorage.setItem("clinic-manager-calendar-view", storedCalendarView);
  }, calendarView);
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.google={accounts:{oauth2:{}}};" })
  );
  await page.route("https://www.hebcal.com/**", (route) => route.fulfill({ json: { items: [] } }));
  // Google Docs is only ever mocked; the inserted text is captured so the generated
  // session document can be asserted without touching a real document.
  await page.route("https://docs.googleapis.com/**", (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      for (const entry of request.postDataJSON()?.requests || []) {
        if (entry.insertText?.text) captured.documentInserts.push(entry.insertText.text);
      }
    }
    return route.fulfill({ json: {} });
  });

  await page.route("https://sheets.googleapis.com/**", async (route) => {
    const request = route.request();
    const decoded = decodeURIComponent(request.url());
    const failure = scriptedFailure(sheetFailures, decoded, request);
    if (failure) {
      captured.sheetFailures.push({ url: decoded, status: failure.status });
      return route.fulfill({
        status: failure.status,
        headers: failure.headers || {},
        json: { error: { code: failure.status, message: failure.message || "scripted failure" } }
      });
    }
    if (decoded.includes("fields=sheets.properties")) {
      return route.fulfill({ json: sheetPropertiesJson(Object.keys(SHEET_HEADERS), liveGridColumns) });
    }
    if (decoded.includes("/values:batchGet")) {
      captured.batchGets.push(new URL(request.url()).searchParams.getAll("ranges"));
      return route.fulfill({
        json: batchGetJson(request, (range) => {
          const [sheet, cells] = range.split("!");
          if (cells === "1:1") return [liveHeaders[sheet] || []];
          return store[sheet] || [];
        })
      });
    }
    if (decoded.endsWith(":batchUpdate") && request.method() === "POST") {
      const requests = request.postDataJSON()?.requests || [];
      for (const entry of requests) {
        if (entry.appendDimension) {
          const title = Object.keys(SHEET_HEADERS)[Number(entry.appendDimension.sheetId) - 1];
          captured.gridAppends.push({ sheet: title, length: entry.appendDimension.length });
          liveGridColumns[title] += Number(entry.appendDimension.length || 0);
        }
        if (entry.deleteDimension) {
          // Row deletion is applied in request order, exactly as Sheets does, so a spec can
          // verify the app orders its ranges bottom-up.
          const { sheetId, dimension, startIndex, endIndex } = entry.deleteDimension.range;
          const title = Object.keys(SHEET_HEADERS)[Number(sheetId) - 1];
          captured.rowDeletes.push({ sheet: title, dimension, startIndex, endIndex });
          if (dimension === "ROWS" && store[title]) store[title].splice(startIndex - 1, endIndex - startIndex);
        }
      }
      return route.fulfill({ json: {} });
    }
    const headerEntry = Object.keys(SHEET_HEADERS).find((sheet) => decoded.includes(`${sheet}!1:1`));
    if (headerEntry) return route.fulfill({ json: { values: [liveHeaders[headerEntry]] } });
    const sheet = decoded.match(/values\/([a-z_]+)!/)?.[1];
    if (!sheet || !store[sheet]) return route.fulfill({ json: {} });
    const rows = store[sheet];
    const lastColumn = columnLetter(SHEET_HEADERS[sheet].length);
    if (decoded.includes(`${sheet}!A1:${lastColumn}1`) && request.method() === "PUT") {
      const values = request.postDataJSON()?.values || [];
      captured.headerPuts.push({ sheet, row: [...(values[0] || [])] });
      if (values[0]) liveHeaders[sheet] = [...values[0]];
      return route.fulfill({ json: {} });
    }
    if (decoded.includes(`${sheet}!A:${lastColumn}:append`)) {
      const values = request.postDataJSON()?.values || [];
      captured.appends.push(...values.map((row) => ({ sheet, row: [...row] })));
      captured.appendCalls.push({ sheet, rows: values.length });
      rows.push(...values.map((row) => [...row]));
      const firstRow = rows.length - values.length + 2;
      return route.fulfill({
        json: { updates: { updatedRange: `${sheet}!A${firstRow}:${lastColumn}${rows.length + 1}` } }
      });
    }
    // A single-column range write (audit_log!H2:H40) updates that column across the rows.
    const columnMatch = decoded.match(new RegExp(`${sheet}!([B-Z]+)(\\d+):\\1(\\d+)`));
    if (columnMatch && request.method() === "PUT") {
      const values = request.postDataJSON()?.values || [];
      const columnIndex = columnMatch[1].charCodeAt(0) - 65;
      captured.columnPuts.push({ sheet, range: columnMatch[0], values: values.map((row) => row[0]) });
      values.forEach((row, offset) => {
        const target = rows[Number(columnMatch[2]) - 2 + offset];
        if (target) target[columnIndex] = row[0];
      });
      return route.fulfill({ json: {} });
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
    const permissionMatch = decoded.match(/\/drive\/v3\/files\/([^/?]+)\/permissions(?:\/([^/?]+))?/);
    if (permissionMatch) {
      const [, fileId, permissionId] = permissionMatch;
      if (request.method() === "DELETE") {
        captured.permissionDeletes.push({ fileId, permissionId });
        drivePermissions[fileId] = (drivePermissions[fileId] || []).filter((item) => item.id !== permissionId);
        return route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      }
      return route.fulfill({ headers: CORS_HEADERS, json: { permissions: drivePermissions[fileId] || [] } });
    }
    if (decoded.includes("/calendar/v3/")) {
      captured.calendar.push({ method: request.method(), url: decoded });
      const calendarFailure = scriptedFailure(calendarFailures, decoded, request);
      if (calendarFailure) {
        captured.calendarFailures.push({ url: decoded, status: calendarFailure.status });
        return route.fulfill({
          status: calendarFailure.status,
          headers: CORS_HEADERS,
          json: { error: { code: calendarFailure.status, message: "scripted calendar failure" } }
        });
      }
      // Requests that address an existing event echo its id back, so the app never
      // rewrites a seeded event id; only a created event gets the canned id.
      const eventMatch = decoded.match(/\/events\/([^/?]+)/);
      return route.fulfill({
        headers: CORS_HEADERS,
        json: { id: eventMatch ? eventMatch[1] : "calendar-event-1" }
      });
    }
    if (request.method() === "GET" && decoded.includes("/drive/v3/files?")) {
      const query = new URL(request.url()).searchParams.get("q") || "";
      captured.driveQueries.push(query);
      if (query.includes("visibility = 'anyoneWithLink'")) {
        return route.fulfill({ headers: CORS_HEADERS, json: { files: publicFiles } });
      }
      if (drive.settings && query.includes("name='clinic-manager-settings.json'")) {
        return route.fulfill({ headers: CORS_HEADERS, json: { files: [{ id: "settings-file", name: "clinic-manager-settings.json" }] } });
      }
    }
    const fileMatch = decoded.match(/\/drive\/v3\/files\/([^/?]+)\?(.*)$/);
    if (fileMatch && request.method() === "GET") {
      const [, fileId, search] = fileMatch;
      if (search.includes("alt=media") && fileId === "settings-file" && drive.settings) {
        return route.fulfill({ headers: CORS_HEADERS, json: drive.settings });
      }
      if (search.includes("fields=parents")) {
        return route.fulfill({ headers: CORS_HEADERS, json: { id: fileId, parents: driveParents[fileId] || [] } });
      }
    }
    // Folder creation (patient folders, business periods) succeeds with a generated id.
    if (request.method() === "POST" && decoded.includes("/drive/v3/files")) {
      const body = request.postDataJSON() || {};
      if (body.mimeType === "application/vnd.google-apps.folder") {
        captured.driveFolders.push({ name: body.name, parents: body.parents || [] });
        return route.fulfill({ headers: CORS_HEADERS, json: { id: `folder-${captured.driveFolders.length}`, name: body.name } });
      }
    }
    if (decoded.includes("/drive/v3/files")) return route.fulfill({ headers: CORS_HEADERS, json: { files: [] } });
    return route.fulfill({ headers: CORS_HEADERS, json: {} });
  });

  return { captured, store };
}

export function patientRow(id, name, fixedPrice) {
  return [id, name, "", "בית ספר", "רגשי", fixedPrice, "שני", "10:00", "", "", "", "active", "cash", "unpaid", "not_needed", `folder-${id}`, "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z", "2026-01-01", "2026-12-31", "", ""];
}

export function sessionRow(id, patientId, date, summary, nextPlan = "") {
  return [id, patientId, date, "10:00", "10:45", "קליניקה", "טיפול", summary, "", "calendar-event-1", `${date}T08:00:00.000Z`, `${date}T08:00:00.000Z`, "", nextPlan];
}

export function goalRow(id, patientId, title, progress = "0", status = "active") {
  return [id, patientId, title, "", status, progress, "", "", "", "2026-01-01T08:00:00.000Z", "2026-01-01T08:00:00.000Z"];
}

export function chargeRow(id, sessionId, patientId, date, amount) {
  return [id, sessionId, patientId, date, amount, `${date}T09:00:00.000Z`, `${date}T09:00:00.000Z`];
}
