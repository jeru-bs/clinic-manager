(function exposeScheduleCore(root) {
  "use strict";

  const { isoDate, dateFromInput, dateRange, addMinutes } = root.CLINIC_FORMAT_CORE;

  const HOLIDAY_KEEP_ALLOWED_PATTERN = /chanukah|hanukkah|חנוכה/i;

  // Tisha B'Av is a fast in the Hebcal data but is treated like a festival here.
  const HOLIDAY_MAJOR_FAST_PATTERN = /tish'?a b'?av|תשעה באב/i;

  // A treatment may stay in place only on Hanukkah and on the minor fasts, which are ordinary
  // working days. Every festival, Yom Kippur and Tisha B'Av must be cancelled or moved.
  function israelHolidayConflictKind(item) {
    if (item?.conflictKind === "optional" || item?.conflictKind === "required") return item.conflictKind;
    const text = `${item?.title || ""} ${item?.hebrew || ""}`;
    if (HOLIDAY_KEEP_ALLOWED_PATTERN.test(text)) return "optional";
    if (HOLIDAY_MAJOR_FAST_PATTERN.test(text)) return "required";
    if (String(item?.subcat || "") === "fast") return "optional";
    return "required";
  }

  function normalizeIsraelHoliday(item) {
    const sourceLink = String(item?.link || "");
    const safeLink = /^https:\/\/(?:www\.)?hebcal\.com\//.test(sourceLink)
      ? sourceLink
      : "https://www.hebcal.com/";
    return {
      date: item?.date || "",
      title: item?.hebrew || item?.title || "מועד ישראל",
      memo: item?.memo || "",
      link: safeLink,
      subcat: item?.subcat || "",
      yomtov: item?.yomtov === true,
      // Stored with the holiday so a cached round-trip, which loses the English title, still
      // classifies the conflict the same way.
      conflictKind: israelHolidayConflictKind(item)
    };
  }

  // The strictest holiday of the day decides which choices the therapist is offered.
  function israelHolidayConflictKindForDate(holidays) {
    return holidays.some((holiday) => israelHolidayConflictKind(holiday) === "required")
      ? "required"
      : "optional";
  }

  // Recurring projections have no sheet row yet: they can be opened and documented, but a
  // status change needs a stored session first.
  function sessionIsProjected(session) {
    return Boolean(session.is_recurring) || !session._rowNumber;
  }

  // Outstanding balances grouped per patient, oldest unpaid session first.
  function dashboardDebtRows(balances) {
    const byPatient = new Map();
    for (const balance of balances) {
      if (balance.remainingAgorot <= 0) continue;
      const entry = byPatient.get(balance.patientId) || { patientId: balance.patientId, remainingAgorot: 0, oldestDate: "", count: 0 };
      entry.remainingAgorot += balance.remainingAgorot;
      entry.count += 1;
      const date = String(balance.sessionDate || "");
      if (date && (!entry.oldestDate || date < entry.oldestDate)) entry.oldestDate = date;
      byPatient.set(balance.patientId, entry);
    }
    return [...byPatient.values()].sort(
      (first, second) =>
        (first.oldestDate || "9999").localeCompare(second.oldestDate || "9999") || second.remainingAgorot - first.remainingAgorot
    );
  }

  // Open tasks ordered overdue first, then by due date; undated tasks close the list.
  function dashboardTaskRows(tasks, today) {
    const rank = (task) => {
      const due = String(task.due_date || task.reminder_at || "");
      if (!due) return "2";
      return `${due < today ? "0" : "1"}${due}`;
    };
    return tasks.filter((task) => task.status !== "done").sort((first, second) => rank(first).localeCompare(rank(second)));
  }

  // Chronological order of a session: date first, then start time, then creation time.
  function sessionChronologyKey(session) {
    return `${session?.session_date || ""} ${session?.start_time || ""} ${session?.created_at || ""}`;
  }

  function taskDueMatches(task, dueFilter, today = isoDate(new Date())) {
    if (!dueFilter) return true;
    if (dueFilter === "overdue") return task.status !== "done" && task.due_date && task.due_date < today;
    if (dueFilter === "today") return task.due_date === today;
    if (dueFilter === "week") {
      const weekDates = dateRange(today, 7);
      const weekEnd = weekDates[weekDates.length - 1];
      return Boolean(task.due_date && task.due_date >= today && task.due_date <= weekEnd);
    }
    if (dueFilter === "no_date") return !task.due_date;
    return true;
  }

  const RECURRING_PLACEHOLDER_SUMMARY = "מפגש קבוע לפי הגדרת המטופל.";

  const SESSION_STATUS_LABELS = {
    scheduled: "מתוכנן",
    completed: "התקיים",
    cancelled: "בוטל",
    cancelled_late: "ביטול מאוחר",
    no_show: "לא הגיע"
  };

  // Late cancellations behave like cancellations for the calendar; they differ only in billing.
  function isCancelledStatus(status) {
    return status === "cancelled" || status === "cancelled_late";
  }

  const SESSION_STATUS_TONES = {
    scheduled: "",
    completed: "success",
    cancelled: "danger",
    cancelled_late: "danger",
    no_show: "warning"
  };

  function sessionHasDocumentation(session) {
    const summary = String(session?.summary || "").trim();
    return Boolean(summary) && summary !== RECURRING_PLACEHOLDER_SUMMARY;
  }

  // Legacy rows have no stored status; documented sessions read as completed and the rest as
  // scheduled, so history keeps its meaning without backfilling invented facts.
  function sessionEffectiveStatus(session) {
    const stored = String(session?.status || "").trim();
    if (SESSION_STATUS_LABELS[stored]) return stored;
    return sessionHasDocumentation(session) ? "completed" : "scheduled";
  }

  function sessionStatusLabel(session) {
    return SESSION_STATUS_LABELS[sessionEffectiveStatus(session)] || SESSION_STATUS_LABELS.scheduled;
  }

  function sessionIsCancelled(session) {
    return isCancelledStatus(sessionEffectiveStatus(session));
  }

  // Cancelled sessions free their calendar slot; no-shows keep it because the time was reserved.
  function sessionOccupiesSlot(session) {
    return !sessionIsCancelled(session);
  }

  function fixedDayIndex(value = "") {
    const day = String(value || "");
    if (day.includes("ראש")) return 0;
    if (day.includes("שני")) return 1;
    if (day.includes("שלישי")) return 2;
    if (day.includes("רביעי")) return 3;
    if (day.includes("חמישי")) return 4;
    if (day.includes("שישי")) return 5;
    if (day.includes("שבת")) return 6;
    return -1;
  }

  function exceptionApplies(exception, patientId, dateValue) {
    if (!exception?.start_date) return false;
    const endDate = exception.end_date || exception.start_date;
    const appliesToPatient = !exception.patient_id || exception.patient_id === patientId;
    return appliesToPatient && dateValue >= exception.start_date && dateValue <= endDate;
  }

  const MAX_RECURRING_OCCURRENCES = 400;

  // A fixed treatment is only valid as a bounded series: day, time, start and end together.
  function normalizeRecurringBounds(data) {
    const fixedDay = String(data?.fixed_day || "").trim();
    const fixedTime = String(data?.fixed_time || "").trim();
    const startDate = String(data?.fixed_start_date || "").trim();
    const endDate = String(data?.fixed_end_date || "").trim();

    if (!fixedDay && !fixedTime) {
      if (startDate || endDate) {
        throw new Error("אי אפשר להגדיר טווח תאריכים בלי יום קבוע ושעה קבועה.");
      }
      return { fixedDay: "", fixedTime: "", startDate: "", endDate: "" };
    }
    if (!fixedDay || !fixedTime) {
      throw new Error("לטיפול קבוע צריך להגדיר גם יום קבוע וגם שעה קבועה.");
    }
    if (!startDate || !endDate) {
      throw new Error("לטיפול קבוע צריך להגדיר תאריך התחלה ותאריך סיום.");
    }
    if (endDate < startDate) {
      throw new Error("תאריך הסיום של הטיפול הקבוע לא יכול להיות לפני תאריך ההתחלה.");
    }
    return { fixedDay, fixedTime, startDate, endDate };
  }

  function recurringSeriesDates(fixedDay, startDate, endDate) {
    const dayIndex = fixedDayIndex(fixedDay);
    if (dayIndex < 0 || !startDate || !endDate || endDate < startDate) return [];

    const cursor = dateFromInput(startDate);
    while (cursor.getDay() !== dayIndex) cursor.setDate(cursor.getDate() + 1);

    const dates = [];
    while (isoDate(cursor) <= endDate && dates.length <= MAX_RECURRING_OCCURRENCES) {
      dates.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return dates;
  }

  // A stored session sits on a recurring series when it matches the patient's fixed day inside the
  // stored bounds. Deleting such a session has to leave a cancellation behind, otherwise the virtual
  // projection immediately shows the deleted date again.
  function recurringSeriesSlot(session, patient) {
    const dateValue = String(session?.session_date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
    if (!patient?.fixed_day || !patient?.fixed_time) return null;
    if (patient.fixed_start_date && dateValue < patient.fixed_start_date) return null;
    if (patient.fixed_end_date && dateValue > patient.fixed_end_date) return null;
    if (fixedDayIndex(patient.fixed_day) !== dateFromInput(dateValue).getDay()) return null;
    return { patientId: patient.id, dateValue };
  }

  function sessionEndTimeValue(session) {
    if (session?.end_time) return session.end_time;
    return session?.start_time ? addMinutes(session.start_time, 50) : "";
  }

  const api = {
    israelHolidayConflictKind,
    normalizeIsraelHoliday,
    israelHolidayConflictKindForDate,
    sessionIsProjected,
    dashboardDebtRows,
    dashboardTaskRows,
    sessionChronologyKey,
    taskDueMatches,
    RECURRING_PLACEHOLDER_SUMMARY,
    SESSION_STATUS_LABELS,
    isCancelledStatus,
    SESSION_STATUS_TONES,
    sessionHasDocumentation,
    sessionEffectiveStatus,
    sessionStatusLabel,
    sessionIsCancelled,
    sessionOccupiesSlot,
    fixedDayIndex,
    exceptionApplies,
    MAX_RECURRING_OCCURRENCES,
    normalizeRecurringBounds,
    recurringSeriesDates,
    recurringSeriesSlot,
    sessionEndTimeValue
  };
  root.CLINIC_SCHEDULE_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
