(function exposeBusinessCore(root) {
  "use strict";

  const BUSINESS_ROOT_FOLDER_NAME = "ניהול עסק";

  const PERIODS = [
    { key: "01-02", label: "ינואר - פברואר", months: [1, 2] },
    { key: "03-04", label: "מרץ - אפריל", months: [3, 4] },
    { key: "05-06", label: "מאי - יוני", months: [5, 6] },
    { key: "07-08", label: "יולי - אוגוסט", months: [7, 8] },
    { key: "09-10", label: "ספטמבר - אוקטובר", months: [9, 10] },
    { key: "11-12", label: "נובמבר - דצמבר", months: [11, 12] }
  ];

  function periodForMonth(month) {
    return PERIODS.find((period) => period.months.includes(Number(month))) || null;
  }

  function isValidIsoDate(value) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }

  function periodForDate(dateValue) {
    if (!isValidIsoDate(dateValue)) return null;
    const [year, month] = String(dateValue).split("-");
    const period = periodForMonth(Number(month));
    if (!period) return null;
    return { year, key: period.key, label: period.label };
  }

  function parseAmountToAgorot(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null;
    const [shekels, fraction = ""] = text.split(".");
    const agorot = Number(shekels) * 100 + Number(`${fraction}00`.slice(0, 2));
    return agorot > 0 ? agorot : null;
  }

  function agorotToAmountText(agorot) {
    const value = Number(agorot) || 0;
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  }

  function summarizeRecords(records) {
    let incomeAgorot = 0;
    let expenseAgorot = 0;
    for (const record of records || []) {
      const agorot = parseAmountToAgorot(record?.amount);
      if (agorot === null) continue;
      if (record.record_type === "income") incomeAgorot += agorot;
      else if (record.record_type === "expense") expenseAgorot += agorot;
    }
    return { incomeAgorot, expenseAgorot, balanceAgorot: incomeAgorot - expenseAgorot };
  }

  function recordsInPeriod(records, year, periodKey) {
    return (records || []).filter((record) => {
      const period = periodForDate(record?.document_date);
      return Boolean(period) && period.year === String(year) && period.key === periodKey;
    });
  }

  function recordsInRange(records, startDate, endDate) {
    return (records || []).filter((record) => {
      const date = String(record?.document_date || "");
      return isValidIsoDate(date) && date >= startDate && date <= endDate;
    });
  }

  function validateRecordInput(input) {
    if (!isValidIsoDate(input?.document_date)) {
      return { error: "תאריך המסמך אינו תקין." };
    }
    if (!["income", "expense"].includes(input?.record_type)) {
      return { error: "צריך לבחור סוג רשומה: הכנסה או הוצאה." };
    }
    const amountAgorot = parseAmountToAgorot(input?.amount);
    if (amountAgorot === null) {
      return { error: "הסכום חייב להיות מספר חיובי עם עד שתי ספרות אחרי הנקודה." };
    }
    return { error: "", amountAgorot, amount: agorotToAmountText(amountAgorot) };
  }

  const api = {
    BUSINESS_ROOT_FOLDER_NAME,
    PERIODS,
    periodForMonth,
    isValidIsoDate,
    periodForDate,
    parseAmountToAgorot,
    agorotToAmountText,
    summarizeRecords,
    recordsInPeriod,
    recordsInRange,
    validateRecordInput
  };
  root.CLINIC_BUSINESS_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
