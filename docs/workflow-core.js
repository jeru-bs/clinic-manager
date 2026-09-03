(function exposeWorkflowCore(root) {
  "use strict";

  const TABLES = [
    "patients",
    "sessions",
    "payments",
    "tasks",
    "files",
    "contacts",
    "goals",
    "goal_updates",
    "questionnaire_templates",
    "questionnaire_assignments",
    "questionnaire_responses",
    "clinical_reports",
    "schedule_exceptions",
    "business_records",
    "session_charges",
    "payment_allocations"
  ];

  function cleanRecord(record) {
    if (!record) return null;
    const copy = { ...record };
    delete copy._rowNumber;
    delete copy._loadedVersion;
    return copy;
  }

  function recordVersion(record) {
    if (!record) return "";
    const clean = cleanRecord(record);
    return JSON.stringify(
      Object.keys(clean)
        .sort()
        .map((key) => [key, clean[key] ?? ""])
    );
  }

  function rowConflict(current, expected) {
    if (!current || !expected) return true;
    if (String(current.id || "") !== String(expected.id || "")) return true;
    return Boolean(expected._loadedVersion && recordVersion(current) !== expected._loadedVersion);
  }

  function snapshot(collections) {
    return Object.fromEntries(
      TABLES.map((table) => [
        table,
        (collections[table] || []).map((record) => ({ ...cleanRecord(record), _rowNumber: record._rowNumber || "" }))
      ])
    );
  }

  function diff(before, after) {
    const mutations = [];
    for (const table of TABLES) {
      const beforeRows = new Map((before[table] || []).map((row) => [row.id, row]));
      const afterRows = new Map((after[table] || []).map((row) => [row.id, row]));
      const ids = new Set([...beforeRows.keys(), ...afterRows.keys()]);
      for (const id of ids) {
        const oldRow = beforeRows.get(id) || null;
        const newRow = afterRows.get(id) || null;
        if (JSON.stringify(oldRow) === JSON.stringify(newRow)) continue;
        mutations.push({
          table,
          rowNumber: newRow?._rowNumber || oldRow?._rowNumber || "",
          before: cleanRecord(oldRow),
          after: cleanRecord(newRow)
        });
      }
    }
    return mutations;
  }

  function inverse(mutations) {
    return [...mutations].reverse().map((mutation) => ({
      table: mutation.table,
      rowNumber: mutation.rowNumber,
      before: mutation.after,
      after: mutation.before
    }));
  }

  function reminderState(task, today) {
    if (!task || task.status === "done") return "inactive";
    const reminderDate = task.reminder_at || task.due_date || "";
    if (!reminderDate) return "scheduled";
    if (reminderDate < today) return "overdue";
    if (reminderDate === today) return "today";
    return "scheduled";
  }

  function validateBackup(payload, requiredTables) {
    if (!payload || payload.app !== "clinic-manager" || !payload.data || typeof payload.data !== "object") {
      throw new Error("קובץ הגיבוי אינו שייך למערכת ניהול הקליניקה.");
    }
    const tables = requiredTables || TABLES;
    for (const table of tables) {
      const rows = payload.data[table];
      if (!Array.isArray(rows)) throw new Error(`בגיבוי חסרה טבלת ${table}.`);
      const ids = new Set();
      for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`טבלת ${table} מכילה רשומה לא תקינה.`);
        if (!row.id) throw new Error(`בטבלת ${table} נמצאה רשומה ללא מזהה.`);
        if (ids.has(row.id)) throw new Error(`בטבלת ${table} נמצא מזהה כפול: ${row.id}.`);
        ids.add(row.id);
      }
    }
    return true;
  }

  // The audit log is never exported: it holds full before/after snapshots of every record.
  const BACKUP_EXCLUDED_TABLES = ["audit_log"];

  function backupTables(tables) {
    return (tables || TABLES).filter((table) => !BACKUP_EXCLUDED_TABLES.includes(table));
  }

  // Keys that localStorage, the shared Drive settings file and the Settings form may override.
  // googleClientId is deliberately absent: it comes only from config.js.
  const OVERRIDABLE_CONFIG_KEYS = [
    "appName",
    "googleDriveRootFolderId",
    "googleTemplatesFolderId",
    "googleSpreadsheetId",
    "googleCalendarId",
    "allowedUserEmails",
    "sessionTypes",
    "sessionLocations",
    "noShowPolicyDefault",
    "noShowFeeDefault"
  ];

  function pickOverridableConfig(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    const picked = {};
    for (const key of OVERRIDABLE_CONFIG_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const value = source[key];
      if (typeof value === "string") picked[key] = value;
      else if (Array.isArray(value)) picked[key] = value.filter((item) => typeof item === "string");
    }
    return picked;
  }

  const SAFE_HREF_PATTERN = /^(https?:\/\/|mailto:|tel:)/i;

  function safeHref(url) {
    const text = String(url ?? "").trim();
    return SAFE_HREF_PATTERN.test(text) ? text : "#";
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  // Splits Drive permissions into public ones (removed automatically) and foreign ones
  // (domain grants or users outside the allowlist) that are only reported.
  function classifySharingPermissions(permissions, allowedEmails) {
    const allowed = new Set((allowedEmails || []).map(normalizeEmail).filter(Boolean));
    const publicPermissions = [];
    const foreignPermissions = [];
    for (const permission of permissions || []) {
      if (!permission || typeof permission !== "object") continue;
      if (permission.type === "anyone") {
        publicPermissions.push(permission);
      } else if (permission.type === "domain") {
        foreignPermissions.push({ ...permission, subject: permission.domain || "" });
      } else if (permission.type === "user" || permission.type === "group") {
        const email = normalizeEmail(permission.emailAddress);
        if (!email || !allowed.has(email)) foreignPermissions.push({ ...permission, subject: email });
      }
    }
    return { publicPermissions, foreignPermissions };
  }

  function googleFailure(status, message) {
    const text = String(message || "").toLowerCase();
    if (status === 401 || text.includes("invalid credentials") || text.includes("invalid_token")) return "reauth";
    if (status === 403 && (text.includes("api has not been used") || text.includes("accessnotconfigured"))) return "api_disabled";
    if (status === 403) return "permission";
    if (status === 404) return "not_found";
    if (status === 429) return "rate_limit";
    if (status >= 500) return "temporary";
    return "unknown";
  }

  const DEFAULT_SESSION_MINUTES = 50;

  function timeToMinutes(timeValue) {
    const text = String(timeValue || "").trim();
    if (!text.includes(":")) return null;
    const [hoursText, minutesText] = text.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function appointmentInterval(startTime, endTime) {
    const start = timeToMinutes(startTime);
    if (start === null) return null;
    const end = timeToMinutes(endTime);
    if (end !== null && end > start) return { start, end };
    return { start, end: start + DEFAULT_SESSION_MINUTES };
  }

  function overlapKind(candidate, occupied) {
    if (candidate.start >= occupied.end || candidate.end <= occupied.start) return null;
    const contained = candidate.start >= occupied.start && candidate.end <= occupied.end;
    const containing = occupied.start >= candidate.start && occupied.end <= candidate.end;
    return contained || containing ? "full" : "partial";
  }

  function findScheduleConflict(candidate, appointments) {
    const interval = appointmentInterval(candidate.startTime, candidate.endTime);
    if (!interval) return null;
    const excluded = new Set(candidate.excludeIds || []);
    for (const appointment of appointments || []) {
      if (appointment.id && excluded.has(appointment.id)) continue;
      const occupied = appointmentInterval(appointment.start_time, appointment.end_time);
      if (!occupied) continue;
      const kind = overlapKind(interval, occupied);
      if (!kind) continue;
      return {
        appointment,
        kind,
        occupiedRange: minutesToTime(occupied.start) + "-" + minutesToTime(occupied.end)
      };
    }
    return null;
  }

  function suggestFreeSlots(candidate, appointments, options) {
    const interval = appointmentInterval(candidate.startTime, candidate.endTime);
    if (!interval) return [];
    const settings = options || {};
    const dayStart = timeToMinutes(settings.dayStart || "08:00");
    const dayEnd = timeToMinutes(settings.dayEnd || "20:00");
    const step = settings.stepMinutes || 30;
    const duration = interval.end - interval.start;
    const excluded = new Set(candidate.excludeIds || []);
    const relevant = (appointments || []).filter((appointment) => !appointment.id || !excluded.has(appointment.id));
    const slotIsFree = (start) => {
      const slot = { start, end: start + duration };
      if (slot.start < dayStart || slot.end > dayEnd) return false;
      return relevant.every((appointment) => {
        const occupied = appointmentInterval(appointment.start_time, appointment.end_time);
        return !occupied || !overlapKind(slot, occupied);
      });
    };
    const suggestions = [];
    for (let start = interval.start - step; start >= dayStart; start -= step) {
      if (slotIsFree(start)) {
        suggestions.push(minutesToTime(start));
        break;
      }
    }
    for (let start = interval.start + step; start + duration <= dayEnd; start += step) {
      if (slotIsFree(start)) {
        suggestions.push(minutesToTime(start));
        break;
      }
    }
    return suggestions;
  }

  // ---- Google API retry policy --------------------------------------------------------
  const RETRY_MAX_ATTEMPTS = 4;
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_DELAY_MS = 8000;
  const RETRY_AFTER_MAX_MS = 30000;

  // Rate limits, server errors and network failures (status 0) are worth another attempt;
  // client errors are not.
  function shouldRetryGoogle(status, attempt, maxAttempts = RETRY_MAX_ATTEMPTS) {
    if (Number(attempt) >= maxAttempts) return false;
    const code = Number(status || 0);
    return code === 0 || code === 429 || code >= 500;
  }

  // Exponential backoff with "equal jitter": the delay before retry N lies between half of and
  // the full value of base * 2^(N-1), capped. A Retry-After header (seconds or HTTP date) wins.
  function retryDelayMs(attempt, { retryAfter = "", random = Math.random, now = Date.now() } = {}) {
    const header = String(retryAfter || "").trim();
    if (header) {
      const seconds = Number(header);
      if (Number.isFinite(seconds) && seconds >= 0) return Math.min(RETRY_AFTER_MAX_MS, Math.round(seconds * 1000));
      const at = Date.parse(header);
      if (!Number.isNaN(at)) return Math.max(0, Math.min(RETRY_AFTER_MAX_MS, at - now));
    }
    const cap = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_MS * 2 ** Math.max(0, Number(attempt || 1) - 1));
    const jitter = Math.min(1, Math.max(0, Number(random()) || 0));
    return Math.round(cap / 2 + (cap / 2) * jitter);
  }

  // ---- Audit log limits ----------------------------------------------------------------
  const AUDIT_LOG_MAX_ROWS = 400;
  const AUDIT_MUTATIONS_MAX_CHARS = 45000;
  const AUDIT_TOO_LARGE_NOTE = "רשומה גדולה מדי לביטול";

  // A Sheets cell holds at most 50,000 characters. An oversized mutation list is reduced to row
  // references so the entry still records what changed, but it can no longer be undone.
  function capAuditMutations(mutations, limit = AUDIT_MUTATIONS_MAX_CHARS) {
    const list = Array.isArray(mutations) ? mutations : [];
    const json = JSON.stringify(list);
    if (json.length <= limit) return { json, truncated: false };
    const rows = list.map((mutation) => ({
      table: mutation?.table || "",
      rowNumber: mutation?.rowNumber || "",
      id: mutation?.after?.id || mutation?.before?.id || ""
    }));
    let reduced = JSON.stringify({ truncated: true, note: AUDIT_TOO_LARGE_NOTE, count: list.length, rows });
    if (reduced.length > limit) reduced = JSON.stringify({ truncated: true, note: AUDIT_TOO_LARGE_NOTE, count: list.length, rows: [] });
    return { json: reduced, truncated: true };
  }

  // Row numbers of the oldest entries (by created_at, then row order) beyond the cap.
  function auditRowsToPrune(entries, max = AUDIT_LOG_MAX_ROWS) {
    const rows = (entries || []).filter((entry) => Number(entry?._rowNumber) > 1);
    if (rows.length <= max) return [];
    return [...rows]
      .sort(
        (a, b) =>
          String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
          Number(a._rowNumber) - Number(b._rowNumber)
      )
      .slice(0, rows.length - max)
      .map((entry) => Number(entry._rowNumber));
  }

  // ---- Row deletion planning -----------------------------------------------------------
  const BLANK_ROW_COMPACTION_THRESHOLD = 20;

  // 1-based row numbers of rows whose every cell is blank. `values` is the raw values array
  // read from `firstRow` downwards (the API omits trailing empty rows, so they never count).
  function blankRowNumbers(values, firstRow = 2) {
    const rows = [];
    (values || []).forEach((row, index) => {
      const filled = Array.isArray(row) && row.some((cell) => String(cell ?? "").trim());
      if (!filled) rows.push(index + firstRow);
    });
    return rows;
  }

  // Merges 1-based row numbers into 0-based, end-exclusive ranges ordered last-range-first, so
  // applying them in order never shifts a row a later request still refers to.
  function rowDeleteRanges(rowNumbers) {
    const sorted = [...new Set((rowNumbers || []).map(Number).filter((n) => Number.isInteger(n) && n > 1))].sort((a, b) => a - b);
    const ranges = [];
    for (const rowNumber of sorted) {
      const last = ranges[ranges.length - 1];
      if (last && last.endIndex === rowNumber - 1) last.endIndex = rowNumber;
      else ranges.push({ startIndex: rowNumber - 1, endIndex: rowNumber });
    }
    return ranges.reverse();
  }

  function deleteRowRequests(sheetId, rowNumbers) {
    return rowDeleteRanges(rowNumbers).map((range) => ({
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: range.startIndex, endIndex: range.endIndex } }
    }));
  }

  // ---- Duplicate patient detection -----------------------------------------------------
  function normalizePatientName(name) {
    return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  // A new patient whose name matches an existing non-archived patient (trimmed, case- and
  // whitespace-insensitive). `excludeId` keeps an edited patient from matching itself.
  function findDuplicatePatient(name, patients, excludeId = "") {
    const key = normalizePatientName(name);
    if (!key) return null;
    return (
      (patients || []).find(
        (patient) =>
          patient &&
          patient.id !== excludeId &&
          patient.status !== "archived" &&
          normalizePatientName(patient.child_name) === key
      ) || null
    );
  }

  // ---- Calendar week/day layout ----------------------------------------------------------
  // Pure layout math for the time grid: the app only maps the result onto CSS custom properties.
  const CALENDAR_VIEWS = ["month", "week", "day"];
  const DEFAULT_DAY_START = "07:00";
  const DEFAULT_DAY_END = "21:00";

  function isoParts(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || "").trim());
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  function shiftIsoDate(dateValue, days) {
    const parts = isoParts(dateValue);
    if (!parts) return "";
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));
    return date.toISOString().slice(0, 10);
  }

  // Sunday-first week (Israeli working week), inclusive of Saturday.
  function weekRangeForDate(dateValue) {
    const parts = isoParts(dateValue);
    if (!parts) return null;
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    const start = shiftIsoDate(dateValue, -weekday);
    const dates = [];
    for (let index = 0; index < 7; index += 1) dates.push(shiftIsoDate(start, index));
    return { start, end: dates[6], dates };
  }

  function shiftCalendarDate(dateValue, view, direction) {
    const step = direction < 0 ? -1 : 1;
    if (view === "week") return shiftIsoDate(dateValue, 7 * step);
    if (view === "day") return shiftIsoDate(dateValue, step);
    const parts = isoParts(dateValue);
    if (!parts) return "";
    const monthIndex = parts.month - 1 + step;
    const lastDay = new Date(Date.UTC(parts.year, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(parts.year, monthIndex, Math.min(parts.day, lastDay))).toISOString().slice(0, 10);
  }

  // Whole-hour bounds that always contain the configured working hours and every session.
  function calendarTimeBounds(sessions, options) {
    const dayStart = timeToMinutes(options && options.dayStart);
    const dayEnd = timeToMinutes(options && options.dayEnd);
    let start = dayStart === null ? timeToMinutes(DEFAULT_DAY_START) : dayStart;
    let end = dayEnd === null ? timeToMinutes(DEFAULT_DAY_END) : dayEnd;
    if (end <= start) end = start + 60;
    for (const session of sessions || []) {
      const interval = appointmentInterval(session && session.start_time, session && session.end_time);
      if (!interval) continue;
      if (interval.start < start) start = interval.start;
      if (interval.end > end) end = interval.end;
    }
    start = Math.floor(start / 60) * 60;
    end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
    return { startMinutes: start, endMinutes: end };
  }

  function hourLabels(startMinutes, endMinutes) {
    const labels = [];
    for (let minute = startMinutes; minute < endMinutes; minute += 60) labels.push(minutesToTime(minute));
    return labels;
  }

  // Concurrent sessions share the column width: each overlap cluster gets as many columns as
  // its busiest moment needs, and every block reports its column index and the cluster width.
  function layoutDaySlots(sessions, bounds) {
    const startMinutes =
      bounds && Number.isInteger(bounds.startMinutes) ? bounds.startMinutes : timeToMinutes(DEFAULT_DAY_START);
    const timed = [];
    const untimed = [];
    for (const session of sessions || []) {
      const interval = appointmentInterval(session && session.start_time, session && session.end_time);
      if (!interval) {
        untimed.push(session);
        continue;
      }
      timed.push({ session, start: interval.start, end: interval.end });
    }
    timed.sort(
      (a, b) =>
        a.start - b.start ||
        a.end - b.end ||
        String(a.session.id || "").localeCompare(String(b.session.id || ""))
    );

    const slots = [];
    let cluster = [];
    let clusterEnd = -1;
    const flush = () => {
      const columnEnds = [];
      const placed = cluster.map((entry) => {
        let column = columnEnds.findIndex((endAt) => endAt <= entry.start);
        if (column < 0) {
          column = columnEnds.length;
          columnEnds.push(entry.end);
        } else {
          columnEnds[column] = entry.end;
        }
        return { entry, column };
      });
      for (const item of placed) {
        slots.push({
          id: item.entry.session.id,
          session: item.entry.session,
          startMinutes: item.entry.start,
          endMinutes: item.entry.end,
          top: item.entry.start - startMinutes,
          length: item.entry.end - item.entry.start,
          column: item.column,
          columns: columnEnds.length
        });
      }
      cluster = [];
      clusterEnd = -1;
    };
    for (const entry of timed) {
      if (cluster.length && entry.start >= clusterEnd) flush();
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, entry.end);
    }
    if (cluster.length) flush();
    return { slots, untimed };
  }

  // ---- Global search ---------------------------------------------------------------------
  // Israeli numbers are compared digit-only, with the +972 country code folded into a leading 0.
  function normalizePhoneDigits(value) {
    let digits = String(value || "").replace(/\D+/g, "");
    if (digits.startsWith("972")) digits = "0" + digits.slice(3);
    return digits;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[֑-ׇ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const SEARCH_FIELD_LABELS = {
    child_name: "שם",
    parent_name: "שם הורה",
    parent_phone: "טלפון הורה",
    parent_email: "אימייל הורה",
    contact_name: "איש קשר",
    contact_phone: "טלפון",
    contact_role: "תפקיד",
    organization: "ארגון",
    school: "מוסד",
    address: "כתובת"
  };

  const SEARCH_FIELD_RANK = {
    child_name: 0,
    parent_name: 1,
    parent_phone: 2,
    parent_email: 3,
    school: 4,
    address: 5,
    contact_name: 6,
    contact_phone: 7,
    organization: 8,
    contact_role: 9
  };

  function searchIndex(patients, contacts) {
    const entries = [];
    const names = {};
    const push = (patientId, field, value) => {
      const raw = String(value || "").trim();
      if (!raw || !patientId) return;
      const isPhone = field === "parent_phone" || field === "contact_phone";
      entries.push({
        patientId,
        field,
        value: raw,
        text: normalizeSearchText(raw),
        digits: isPhone ? normalizePhoneDigits(raw) : ""
      });
    };
    for (const patient of patients || []) {
      if (!patient || !patient.id) continue;
      names[patient.id] = String(patient.child_name || "").trim();
      push(patient.id, "child_name", patient.child_name);
      push(patient.id, "school", patient.school_name);
      push(patient.id, "address", patient.address);
    }
    for (const contact of contacts || []) {
      if (!contact || !contact.patient_id || !(contact.patient_id in names)) continue;
      const professional = contact.contact_type === "professional";
      push(contact.patient_id, professional ? "contact_name" : "parent_name", contact.name);
      push(contact.patient_id, professional ? "contact_phone" : "parent_phone", contact.phone);
      if (professional) {
        push(contact.patient_id, "contact_role", contact.relationship);
        push(contact.patient_id, "organization", contact.organization);
      } else {
        push(contact.patient_id, "parent_email", contact.email);
      }
    }
    return { entries, names };
  }

  // Returns at most `limit` patients; each carries the best matching field so the UI can say
  // why the patient matched. Child-name matches rank first, then parents, phones, school...
  function globalSearch(index, query, limit) {
    const max = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const text = normalizeSearchText(query);
    if (text.length < 2 || !index || !Array.isArray(index.entries)) return [];
    const digits = /^[\d\s()+-]+$/.test(String(query || "").trim()) ? normalizePhoneDigits(query) : "";
    const best = {};
    for (const entry of index.entries) {
      let kind = -1;
      if (entry.digits) {
        if (digits.length >= 2) {
          if (entry.digits.startsWith(digits)) kind = 0;
          else if (entry.digits.includes(digits)) kind = 1;
        }
      } else if (entry.text.startsWith(text)) kind = 0;
      else if (entry.text.includes(" " + text)) kind = 1;
      else if (entry.text.includes(text)) kind = 2;
      if (kind < 0) continue;
      const rank = SEARCH_FIELD_RANK[entry.field] === undefined ? 99 : SEARCH_FIELD_RANK[entry.field];
      const candidate = { patientId: entry.patientId, field: entry.field, value: entry.value, kind, rank };
      const current = best[entry.patientId];
      if (
        !current ||
        candidate.rank < current.rank ||
        (candidate.rank === current.rank && candidate.kind < current.kind)
      ) {
        best[entry.patientId] = candidate;
      }
    }
    return Object.values(best)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.kind - b.kind ||
          String(index.names[a.patientId] || "").localeCompare(String(index.names[b.patientId] || ""), "he")
      )
      .slice(0, max)
      .map((item) => ({
        patientId: item.patientId,
        name: index.names[item.patientId] || "",
        field: item.field,
        fieldLabel: SEARCH_FIELD_LABELS[item.field] || "",
        value: item.value
      }));
  }

  const api = {
    TABLES,
    RETRY_MAX_ATTEMPTS,
    shouldRetryGoogle,
    retryDelayMs,
    AUDIT_LOG_MAX_ROWS,
    AUDIT_MUTATIONS_MAX_CHARS,
    AUDIT_TOO_LARGE_NOTE,
    capAuditMutations,
    auditRowsToPrune,
    BLANK_ROW_COMPACTION_THRESHOLD,
    blankRowNumbers,
    rowDeleteRanges,
    deleteRowRequests,
    normalizePatientName,
    findDuplicatePatient,
    timeToMinutes,
    minutesToTime,
    appointmentInterval,
    findScheduleConflict,
    suggestFreeSlots,
    cleanRecord,
    recordVersion,
    rowConflict,
    snapshot,
    diff,
    inverse,
    reminderState,
    validateBackup,
    BACKUP_EXCLUDED_TABLES,
    backupTables,
    OVERRIDABLE_CONFIG_KEYS,
    pickOverridableConfig,
    safeHref,
    classifySharingPermissions,
    googleFailure,
    CALENDAR_VIEWS,
    DEFAULT_DAY_START,
    DEFAULT_DAY_END,
    shiftIsoDate,
    weekRangeForDate,
    shiftCalendarDate,
    calendarTimeBounds,
    hourLabels,
    layoutDaySlots,
    normalizePhoneDigits,
    normalizeSearchText,
    SEARCH_FIELD_LABELS,
    searchIndex,
    globalSearch
  };
  root.CLINIC_WORKFLOW_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
