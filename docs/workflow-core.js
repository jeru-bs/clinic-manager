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

  const api = {
    TABLES,
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
    googleFailure
  };
  root.CLINIC_WORKFLOW_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
