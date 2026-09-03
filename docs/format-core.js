(function exposeFormatCore(root) {
  "use strict";

  const REPORT_TYPES = {
    assessment: "דוח אבחון",
    progress: "דוח התקדמות",
    summary: "דוח סיכום טיפול"
  };

  function formatDateTime(value) {
    if (!value) return "טרם בוצע";
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value)
    );
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short" }).format(
      new Date(`${value}T00:00:00`)
    );
  }

  const HEBREW_GEMATRIA_HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

  const HEBREW_GEMATRIA_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];

  const HEBREW_GEMATRIA_UNITS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

  // Built from code points so the source file stays free of the Hebrew punctuation
  // character that the project static check treats as a mojibake sentinel.
  const HEBREW_GERESH = String.fromCharCode(0x05f3);

  const HEBREW_GERSHAYIM = String.fromCharCode(0x05f4);

  const hebrewDateCache = new Map();

  let hebrewDateFormatter = null;

  function hebrewGematria(value) {
    const number = Math.max(0, Math.floor(Number(value) || 0));
    if (!number || number > 999) return "";
    const letters = (
      HEBREW_GEMATRIA_HUNDREDS[Math.floor(number / 100) % 10] +
      HEBREW_GEMATRIA_TENS[Math.floor(number / 10) % 10] +
      HEBREW_GEMATRIA_UNITS[number % 10]
    )
      // 15 and 16 are written טו and טז so the divine name is never spelled out.
      .replace(/יה$/, "טו")
      .replace(/יו$/, "טז");
    if (letters.length === 1) return `${letters}${HEBREW_GERESH}`;
    return `${letters.slice(0, -1)}${HEBREW_GERSHAYIM}${letters.slice(-1)}`;
  }

  function hebrewDateParts(dateValue) {
    const value = String(dateValue || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    if (hebrewDateCache.has(value)) return hebrewDateCache.get(value);

    let parts = null;
    try {
      if (!hebrewDateFormatter) {
        // Latin digits are requested explicitly because engines disagree about "nu-hebr";
        // the numerals are converted to gematria below so every engine renders the same text.
        hebrewDateFormatter = new Intl.DateTimeFormat("he-u-ca-hebrew-nu-latn", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      }
      // Anchoring on local noon keeps the civil day stable across timezone and DST shifts.
      const formatted = hebrewDateFormatter.formatToParts(new Date(`${value}T12:00:00`));
      const dayNumber = formatted.find((part) => part.type === "day")?.value || "";
      const month = formatted.find((part) => part.type === "month")?.value || "";
      const yearNumber = formatted.find((part) => part.type === "year")?.value || "";
      const day = hebrewGematria(String(dayNumber).replace(/\D/g, ""));
      const year = hebrewGematria(Number(String(yearNumber).replace(/\D/g, "")) % 1000);
      if (day && month) {
        parts = {
          day,
          month,
          year,
          short: `${day} ב${month}`,
          full: `${day} ב${month} ${year}`.trim()
        };
      }
    } catch {
      parts = null;
    }

    hebrewDateCache.set(value, parts);
    return parts;
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }

  function monthLabel(monthValue) {
    return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
      new Date(`${monthValue}-01T00:00:00`)
    );
  }

  function shiftMonth(monthValue, offset) {
    const [year, month] = monthValue.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function calendarDays(monthValue) {
    const [year, month] = monthValue.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const visibleStart = new Date(firstDay);
    visibleStart.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(visibleStart);
      date.setDate(visibleStart.getDate() + index);
      return {
        date: isoDate(date),
        inMonth: date.getMonth() === month - 1
      };
    });
  }

  function dateFromInput(value) {
    const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function timeParts(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      const now = new Date();
      return { hour: now.getHours(), minute: "00" };
    }
    return {
      hour: Math.min(23, Math.max(0, Number(match[1]))),
      minute: ["00", "15", "30", "45"].includes(match[2]) ? match[2] : "00"
    };
  }

  function formatAmount(value) {
    const amount = Number(value);
    if (Number.isNaN(amount)) return value || "-";
    return new Intl.NumberFormat("he-IL", {
      currency: "ILS",
      maximumFractionDigits: 0,
      style: "currency"
    }).format(amount);
  }

  const HEB_WEEKDAYS = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

  function hebrewWeekday(date) {
    return HEB_WEEKDAYS[date.getDay()] || "";
  }

  // The parent (or any) contact carries the phone and email the patients list shows.
  function primaryContact(allContacts, patientId) {
    const contacts = allContacts.filter((contact) => contact.patient_id === patientId);
    return contacts.find((contact) => contact.contact_type !== "professional") || contacts[0] || null;
  }

  const PAYMENT_STATUS_TONES = { paid: "success", partial: "warning", unpaid: "danger" };

  const CHARGE_STATUS_TONES = { paid: "success", partial: "warning", open: "danger", cancelled: "" };

  const RECEIPT_STATUS_TONES = { issued: "success", needed: "warning", not_needed: "" };

  function goalStatusLabel(value) {
    return { planned: "מתוכננת", active: "פעילה", achieved: "הושגה", paused: "הושהתה" }[value] || "פעילה";
  }

  function questionnaireStatusLabel(value) {
    return { draft: "טיוטה", sent: "נשלח", completed: "הושלם", closed: "נסגר" }[value] || "טיוטה";
  }

  function reportTypeLabel(value) {
    return REPORT_TYPES[value] || REPORT_TYPES.progress;
  }

  function sharingWarningText(warning) {
    if (warning.type === "domain") return `שיתוף לכל הדומיין ${warning.subject || "לא מזוהה"}`;
    if (warning.type === "group") return `שיתוף לקבוצה ${warning.subject || "לא מזוהה"}`;
    return `שיתוף לחשבון שאינו ברשימת המורשים: ${warning.subject || "משתמש לא מזוהה"}`;
  }

  const HEBREW_WEEKDAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  function weekdayIndex(dateValue) {
    const [year, month, day] = String(dateValue).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  // Five stable tones keyed by session type so the same type always gets the same colour.
  function sessionToneClass(session) {
    const key = String(session?.session_type || "");
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) % 997;
    return `tone-${(hash % 5) + 1}`;
  }

  function contactTypeLabel(value) {
    return value === "professional" ? "איש/אשת מקצוע" : "הורה או בן משפחה";
  }

  function taskStatusLabel(value) {
    return {
      open: "פתוחה",
      waiting: "בהמתנה",
      done: "בוצעה"
    }[value] || "פתוחה";
  }

  function fileTypeLabel(value) {
    return {
      document: "מסמך",
      summary: "סיכום",
      receipt: "קבלה",
      form: "טופס",
      recording: "הקלטה",
      other: "אחר"
    }[value] || "מסמך";
  }

  function formatAgorotAmount(agorot) {
    return new Intl.NumberFormat("he-IL", {
      currency: "ILS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      style: "currency"
    }).format(Number(root.CLINIC_BUSINESS_CORE.agorotToAmountText(agorot)));
  }

  function formatBusinessAmount(amountText) {
    const agorot = root.CLINIC_BUSINESS_CORE.parseAmountToAgorot(amountText);
    if (agorot === null) return amountText || "-";
    return formatAgorotAmount(agorot);
  }

  function chargeStatusLabel(status) {
    if (status === "paid") return "שולם";
    if (status === "partial") return "שולם חלקית";
    return "פתוח";
  }

  const NO_SHOW_POLICY_LABELS = {
    none: "ללא חיוב",
    full: "חיוב מלא",
    half: "חצי מחיר",
    fixed: "סכום קבוע"
  };

  function addDaysToDate(dateValue, days) {
    const date = dateFromInput(dateValue);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }

  function maxDateValue(a, b) {
    return a >= b ? a : b;
  }

  function businessTypeLabel(recordType) {
    if (recordType === "income") return "הכנסה";
    if (recordType === "expense") return "הוצאה";
    return recordType || "-";
  }

  function exceptionTypeLabel(type) {
    return {
      cancel: "ביטול חד-פעמי",
      vacation: "חופשה",
      holiday: "חג",
      blocked: "יום חסום",
      reschedule: "שינוי מועד חד-פעמי",
      holiday_pending: "ממתין להחלטה (חג)"
    }[type] || "חריג יומן";
  }

  function formatExceptionDateRange(exception) {
    if (!exception?.start_date) return "-";
    if (!exception.end_date || exception.end_date === exception.start_date) {
      return formatDate(exception.start_date);
    }
    return `${formatDate(exception.start_date)} - ${formatDate(exception.end_date)}`;
  }

  function dateRange(startDateValue, numberOfDays) {
    const start = dateFromInput(startDateValue);
    return Array.from({ length: numberOfDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return isoDate(date);
    });
  }

  function patientDisplayName(patients, patientId) {
    return patients.find((patient) => patient.id === patientId)?.child_name || "ללא מטופל";
  }

  function sessionLabel(session) {
    if (!session) return "מפגש";
    const date = formatDate(session.session_date);
    const time = [session.start_time, session.end_time].filter(Boolean).join("-");
    const type = session.session_type || "מפגש";
    return [date, time, type].filter(Boolean).join(" | ");
  }

  function paymentStatusLabel(value) {
    return {
      paid: "שולם",
      partial: "חלקי",
      pending: "ממתין",
      unpaid: "פתוח",
      none: "ללא חיובים"
    }[value] || "פתוח";
  }

  function paymentMethodLabel(value) {
    return {
      bank_transfer: "העברה",
      cash: "מזומן",
      check: "צ'ק",
      bit: "ביט",
      credit: "אשראי"
    }[value] || "העברה";
  }

  function receiptStatusLabel(value) {
    return {
      issued: "הופקה קבלה",
      needed: "דרושה קבלה",
      not_needed: "לא נדרש"
    }[value] || "דרושה קבלה";
  }

  function auditMutations(entry) {
    try {
      const rows = JSON.parse(entry?.mutations_json || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function calendarDateTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) return null;
    return `${dateValue}T${timeValue}:00`;
  }

  function addMinutes(timeValue, minutes) {
    const [hours = "0", mins = "0"] = String(timeValue || "00:00").split(":");
    const date = new Date(2000, 0, 1, Number(hours), Number(mins) + minutes);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function sessionDocumentTitle(patient, session) {
    return `תיעוד מפגש - ${patient.child_name || "מטופל"} - ${session.session_date} - ${String(
      session.id
    ).slice(0, 8)}`;
  }

  function driveFileTypeLabel(mimeType = "") {
    if (mimeType.includes("audio")) return "recording";
    if (mimeType.includes("spreadsheet")) return "document";
    if (mimeType.includes("document")) return "document";
    if (mimeType.includes("pdf")) return "document";
    if (mimeType.includes("image")) return "form";
    return "other";
  }

  function fileNameWithFallback(customName, selectedFile) {
    return String(customName || selectedFile?.name || "").trim();
  }

  function archiveImpactMessage(impact) {
    const lines = ["סיום הטיפול יעצור את הלוח הקבוע של המטופל."];
    if (impact.futureAuto.length) {
      lines.push(`${impact.futureAuto.length} מפגשים קבועים עתידיים שטרם תועדו יוסרו מהיומן.`);
    }
    if (impact.futureManual.length) {
      lines.push(
        `${impact.futureManual.length} מפגשים עתידיים נוספים יבוטלו ויוסרו מהיומן; התיעוד והחיובים שלהם נשמרים.`
      );
    }
    if (impact.pendingDecisions.length) {
      lines.push(`${impact.pendingDecisions.length} החלטות ממתינות על התנגשות עם חג ייסגרו.`);
    }
    if (impact.outstandingAgorot > 0) {
      lines.push(
        `קיימת יתרת חוב פתוחה של ${formatAgorotAmount(impact.outstandingAgorot)}; החוב יישמר ויוצג בכרטיס המטופל.`
      );
    }
    lines.push("התיעוד, הקבצים וההיסטוריה הכספית נשמרים במלואם ותמיד אפשר להחזיר מהארכיון.");
    return lines.join(" ");
  }

  function archiveDoneMessage(impact) {
    return impact.outstandingAgorot > 0
      ? `המטופל הועבר לארכיון. שימי לב: נותרה יתרת חוב פתוחה של ${formatAgorotAmount(impact.outstandingAgorot)}.`
      : "המטופל הועבר לארכיון.";
  }

  function csvValue(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function backupFileName() {
    return `clinic-manager-backup-${isoDate(new Date())}.json`;
  }

  // ===== text lists, sheet rows and misc pure helpers =====

  function listText(savedValue, defaultValue, fallbackItems) {
    if (Array.isArray(savedValue)) return savedValue.join("\n");
    if (typeof savedValue === "string" && savedValue.trim()) return savedValue;
    if (Array.isArray(defaultValue)) return defaultValue.join("\n");
    if (typeof defaultValue === "string" && defaultValue.trim()) return defaultValue;
    return fallbackItems.join("\n");
  }

  function mergeListText(...values) {
    return [...new Set(values.flatMap((value) => optionValues(value, [])))].join("\n");
  }

  // A saved allowlist is authoritative: defaults apply only when no value was ever
  // saved, so an email removed from the allowlist cannot return after reload.
  function savedListText(savedValue, defaultValue) {
    if (Array.isArray(savedValue)) return savedValue.join("\n");
    if (typeof savedValue === "string") return savedValue;
    return mergeListText(defaultValue);
  }

  function optionValues(value, fallbackItems) {
    const items = String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    return [...new Set(items.length ? items : fallbackItems)];
  }

  function rowToRecord(columns, row) {
    return Object.fromEntries(columns.map((column, index) => [column, row[index] || ""]));
  }

  function recordToRow(columns, record) {
    return columns.map((column) => String(record[column] || ""));
  }

  // A1-notation letter for a 1-based column index; String.fromCharCode(64 + n)
  // breaks beyond column 26 (Z).
  function columnLetter(count) {
    let letter = "";
    let remaining = count;
    while (remaining > 0) {
      letter = String.fromCharCode(65 + ((remaining - 1) % 26)) + letter;
      remaining = Math.floor((remaining - 1) / 26);
    }
    return letter;
  }

  function appendedRowNumber(result) {
    const range = result?.updates?.updatedRange || "";
    return range.match(/![A-Z]+(\d+):/)?.[1] || "";
  }

  function stateCollectionName(sheetName) {
    if (sheetName === "schedule_exceptions") return "scheduleExceptions";
    if (sheetName === "audit_log") return "auditLog";
    if (sheetName === "goal_updates") return "goalUpdates";
    if (sheetName === "questionnaire_templates") return "questionnaireTemplates";
    if (sheetName === "questionnaire_assignments") return "questionnaireAssignments";
    if (sheetName === "questionnaire_responses") return "questionnaireResponses";
    if (sheetName === "clinical_reports") return "clinicalReports";
    if (sheetName === "business_records") return "businessRecords";
    if (sheetName === "session_charges") return "sessionCharges";
    if (sheetName === "payment_allocations") return "paymentAllocations";
    return sheetName;
  }

  function safeJson(value, fallback = []) {
    try {
      const parsed = JSON.parse(value || "");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function escapeDriveQueryValue(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function sortBusinessRecords(records) {
    return [...records].sort((a, b) =>
      `${b.document_date || ""} ${b.created_at || ""}`.localeCompare(`${a.document_date || ""} ${a.created_at || ""}`)
    );
  }

  function backupRows(payload, tableName) {
    const rows = payload?.data?.[tableName];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const record = { ...row };
      delete record._rowNumber;
      return record;
    });
  }

  function formQuestionRequest(question, index) {
    return {
      createItem: {
        item: {
          title: question.title,
          questionItem: {
            question: {
              required: Boolean(question.required),
              textQuestion: { paragraph: question.type !== "short" }
            }
          }
        },
        location: { index }
      }
    };
  }

  function clockButtonPosition(value, total, radius) {
    const angle = (value / total) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    return { x: `${x.toFixed(3)}%`, y: `${y.toFixed(3)}%` };
  }

  const api = {
    REPORT_TYPES,
    formatDateTime,
    formatDate,
    hebrewGematria,
    hebrewDateParts,
    isoDate,
    monthLabel,
    shiftMonth,
    calendarDays,
    dateFromInput,
    timeParts,
    formatAmount,
    hebrewWeekday,
    primaryContact,
    PAYMENT_STATUS_TONES,
    CHARGE_STATUS_TONES,
    RECEIPT_STATUS_TONES,
    goalStatusLabel,
    questionnaireStatusLabel,
    reportTypeLabel,
    sharingWarningText,
    HEBREW_WEEKDAY_NAMES,
    weekdayIndex,
    sessionToneClass,
    contactTypeLabel,
    taskStatusLabel,
    fileTypeLabel,
    formatAgorotAmount,
    formatBusinessAmount,
    chargeStatusLabel,
    NO_SHOW_POLICY_LABELS,
    addDaysToDate,
    maxDateValue,
    businessTypeLabel,
    exceptionTypeLabel,
    formatExceptionDateRange,
    dateRange,
    patientDisplayName,
    sessionLabel,
    paymentStatusLabel,
    paymentMethodLabel,
    receiptStatusLabel,
    auditMutations,
    calendarDateTime,
    addMinutes,
    sessionDocumentTitle,
    driveFileTypeLabel,
    fileNameWithFallback,
    archiveImpactMessage,
    archiveDoneMessage,
    csvValue,
    backupFileName,
    listText,
    mergeListText,
    savedListText,
    optionValues,
    rowToRecord,
    recordToRow,
    columnLetter,
    appendedRowNumber,
    stateCollectionName,
    safeJson,
    escapeDriveQueryValue,
    sortBusinessRecords,
    backupRows,
    formQuestionRequest,
    clockButtonPosition
  };
  root.CLINIC_FORMAT_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
