const SHEETS = {
  patients: [
    "id",
    "child_name",
    "address",
    "school_name",
    "treatment_type",
    "fixed_price",
    "fixed_day",
    "fixed_time",
    "treatment_goals",
    "sensitive_notes",
    "general_notes",
    "status",
    "default_payment_method",
    "payment_status",
    "receipt_status",
    "drive_folder_id",
    "drive_folder_path",
    "created_at",
    "updated_at"
  ],
  sessions: [
    "id",
    "patient_id",
    "session_date",
    "start_time",
    "end_time",
    "location",
    "session_type",
    "summary",
    "sensitive_notes",
    "calendar_event_id",
    "created_at",
    "updated_at",
    "document_file_id"
  ],
  payments: [
    "id",
    "patient_id",
    "session_id",
    "amount",
    "payment_method",
    "payment_status",
    "receipt_status",
    "paid_at",
    "receipt_file_id",
    "notes",
    "created_at",
    "updated_at"
  ],
  tasks: [
    "id",
    "patient_id",
    "title",
    "description",
    "status",
    "due_date",
    "source",
    "created_at",
    "updated_at",
    "reminder_at"
  ],
  files: [
    "id",
    "patient_id",
    "drive_file_id",
    "drive_folder_id",
    "name",
    "file_type",
    "url",
    "created_at",
    "updated_at"
  ],
  contacts: [
    "id",
    "patient_id",
    "contact_type",
    "name",
    "relationship",
    "phone",
    "email",
    "organization",
    "notes",
    "created_at",
    "updated_at"
  ],
  goals: [
    "id",
    "patient_id",
    "title",
    "description",
    "status",
    "progress",
    "target_date",
    "note",
    "legacy_source",
    "created_at",
    "updated_at"
  ],
  goal_updates: [
    "id",
    "goal_id",
    "patient_id",
    "session_id",
    "progress",
    "status",
    "note",
    "created_at",
    "updated_at"
  ],
  questionnaire_templates: [
    "id",
    "name",
    "audience",
    "questions_json",
    "active",
    "created_at",
    "updated_at"
  ],
  questionnaire_assignments: [
    "id",
    "patient_id",
    "contact_id",
    "template_id",
    "form_id",
    "responder_url",
    "status",
    "sent_at",
    "due_date",
    "responded_at",
    "last_response_id",
    "created_at",
    "updated_at"
  ],
  questionnaire_responses: [
    "id",
    "assignment_id",
    "patient_id",
    "contact_id",
    "response_id",
    "submitted_at",
    "answers_json",
    "reviewed_at",
    "created_at",
    "updated_at"
  ],
  clinical_reports: [
    "id",
    "patient_id",
    "report_type",
    "title",
    "period_start",
    "period_end",
    "content",
    "document_file_id",
    "pdf_file_id",
    "created_at",
    "updated_at"
  ],
  schedule_exceptions: [
    "id",
    "patient_id",
    "exception_type",
    "start_date",
    "end_date",
    "reason",
    "created_at",
    "updated_at"
  ],
  business_records: [
    "id",
    "document_date",
    "record_type",
    "amount",
    "drive_file_id",
    "drive_folder_id",
    "file_name",
    "file_url",
    "source",
    "payment_id",
    "created_at",
    "updated_at"
  ],
  session_charges: [
    "id",
    "session_id",
    "patient_id",
    "session_date",
    "amount",
    "created_at",
    "updated_at"
  ],
  payment_allocations: [
    "id",
    "payment_id",
    "charge_id",
    "session_id",
    "patient_id",
    "amount",
    "created_at",
    "updated_at"
  ],
  audit_log: [
    "id",
    "action_type",
    "entity_type",
    "entity_id",
    "summary",
    "actor_email",
    "mutations_json",
    "undoable",
    "undone_at",
    "created_at"
  ]
};

const WorkflowCore = window.CLINIC_WORKFLOW_CORE;
const BusinessCore = window.CLINIC_BUSINESS_CORE;
const PaymentsCore = window.CLINIC_PAYMENTS_CORE;

const configDefaults = window.CLINIC_MANAGER_CONFIG || {};
const GOOGLE_TOKEN_KEY = "clinic-manager-google-token";
const GOOGLE_CONSENT_KEY = "clinic-manager-google-consent";
const GOOGLE_ACCOUNT_KEY = "clinic-manager-google-account";
const SYNC_QUEUE_KEY = "clinic-manager-sync-queue-v1";
const SYNC_STATE_KEY = "clinic-manager-sync-state-v1";
const CALENDAR_PRIVACY_MIGRATION_KEY = "clinic-manager-calendar-privacy-v1";
const SETTINGS_FILE_NAME = "clinic-manager-settings.json";
const HEBCAL_API_URL = "https://www.hebcal.com/hebcal";
const HEBCAL_CACHE_PREFIX = "clinic-manager-hebcal-israel";
const HEBCAL_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_TYPES = ["טיפול", "הדרכת הורים", "שיחה", "אבחון"];
const DEFAULT_SESSION_LOCATIONS = ["קליניקה", "בית ספר", "אונליין", "בית"];
const DEFAULT_QUESTIONNAIRE_TEMPLATES = [
  {
    id: "default-parent-questionnaire",
    name: "שאלון הורים",
    audience: "parent",
    questions: [
      { title: "שם ממלא השאלון", type: "short", required: true },
      { title: "הקשר לילד", type: "short", required: true },
      { title: "מהן החוזקות ותחומי העניין המרכזיים?", type: "paragraph", required: false },
      { title: "מהם הקשיים או החששות העיקריים כעת?", type: "paragraph", required: true },
      { title: "כיצד הקשיים משפיעים על התפקוד בבית, בלימודים או בחברה?", type: "paragraph", required: false },
      { title: "אילו שינויים נצפו לאחרונה?", type: "paragraph", required: false },
      { title: "מהן הציפיות והמטרות מהטיפול?", type: "paragraph", required: false },
      { title: "מידע נוסף שחשוב שנדע", type: "paragraph", required: false }
    ]
  },
  {
    id: "default-professional-questionnaire",
    name: "שאלון איש מקצוע",
    audience: "professional",
    questions: [
      { title: "שם, תפקיד ומסגרת", type: "short", required: true },
      { title: "באיזה הקשר ובאיזו תדירות מתקיים הקשר עם הילד?", type: "paragraph", required: true },
      { title: "אילו חוזקות בולטות נצפו?", type: "paragraph", required: false },
      { title: "אילו קשיים נצפו ומה השפעתם התפקודית?", type: "paragraph", required: true },
      { title: "אילו אסטרטגיות או התאמות נוסו עד כה?", type: "paragraph", required: false },
      { title: "מה הייתה התגובה לאסטרטגיות שנוסו?", type: "paragraph", required: false },
      { title: "מהן העדיפויות המומלצות להמשך?", type: "paragraph", required: false },
      { title: "מידע נוסף שחשוב שנדע", type: "paragraph", required: false }
    ]
  }
];
const REPORT_TYPES = {
  assessment: "דוח אבחון",
  progress: "דוח התקדמות",
  summary: "דוח סיכום טיפול"
};
let googleTokenExpiresAt = 0;
let googleRefreshTimer = null;
const state = {
  accessToken: loadStoredGoogleToken(),
  config: loadConfig(),
  googleUser: null,
  authChecked: false,
  authRestoring: false,
  currentPatientId: "",
  currentSessionId: "",
  currentPaymentId: "",
  currentChargeId: "",
  currentTaskId: "",
  currentFileId: "",
  currentContactId: "",
  currentGoalId: "",
  currentQuestionnaireTemplateId: "",
  currentBusinessRecordId: "",
  message: "",
  error: "",
  patients: [],
  sessions: [],
  payments: [],
  tasks: [],
  files: [],
  contacts: [],
  goals: [],
  goalUpdates: [],
  questionnaireTemplates: [],
  questionnaireAssignments: [],
  questionnaireResponses: [],
  clinicalReports: [],
  businessRecords: [],
  sessionCharges: [],
  paymentAllocations: [],
  questionnaireSyncStarted: {},
  scheduleExceptions: [],
  israelHolidays: [],
  israelHolidayYears: [],
  israelHolidayError: "",
  auditLog: [],
  lastUndoActionId: "",
  templates: [],
  dataHealth: null,
  sharingSecurity: null,
  storageReadySpreadsheetId: "",
  syncQueue: loadSyncQueue(),
  saveState: loadSyncState().saveState || "idle",
  lastSavedAt: loadSyncState().lastSavedAt || "",
  lastRefreshAt: loadSyncState().lastRefreshAt || "",
  uploadProgress: null,
  patientFilter: {
    name: "",
    school: "",
    treatment: "",
    status: ""
  },
  taskFilter: {
    status: "",
    patient: "",
    due: ""
  },
  fileFilter: {
    patient: "",
    type: "",
    text: ""
  },
  profileTab: "overview",
  businessView: {
    year: isoDate(new Date()).slice(0, 4),
    period: window.CLINIC_BUSINESS_CORE.periodForDate(isoDate(new Date()))?.key || "01-02",
    rangeStart: "",
    rangeEnd: "",
    range: null
  },
  calendarMonth: isoDate(new Date()).slice(0, 7),
  selectedCalendarDate: isoDate(new Date()),
  reportMonth: isoDate(new Date()).slice(0, 7),
  route: getRoute()
};

let messageDismissTimer = null;
let messageDismissValue = "";
const pendingActions = new Set();
const pendingForms = new WeakSet();
let activeRecorder = null;
let activeRecordingPatientId = "";
let activeRecordingStream = null;
let activeRecordingChunks = [];
let activePickerElement = null;
let lastCalendarSyncError = "";
let lastDocumentSyncError = "";
let googleAuthInFlight = false;
let lastGoogleRestoreAttempt = 0;
let drawerReturnFocus = null;
const loadingIsraelHolidayYears = new Set();
let syncRetryTimer = null;
let syncHideTimer = null;
let syncIndicatorHidden = false;
let syncProcessing = false;
let activeUploadRequest = null;
let uploadCancelled = false;

function loadConfig() {
  const saved = JSON.parse(localStorage.getItem("clinic-manager-config") || "{}");
  return {
    appName: saved.appName || configDefaults.appName || "ניהול קליניקה",
    googleClientId: saved.googleClientId || configDefaults.googleClientId || "",
    googleDriveRootFolderId:
      saved.googleDriveRootFolderId ||
      configDefaults.googleDriveRootFolderId ||
      "",
    googleTemplatesFolderId:
      saved.googleTemplatesFolderId ||
      configDefaults.googleTemplatesFolderId ||
      "",
    googleCalendarId:
      saved.googleCalendarId || configDefaults.googleCalendarId || "primary",
    googleSpreadsheetId:
      saved.googleSpreadsheetId || configDefaults.googleSpreadsheetId || "",
    allowedUserEmails: savedListText(
      saved.allowedUserEmails,
      configDefaults.allowedUserEmails
    ),
    sessionTypes: listText(saved.sessionTypes, configDefaults.sessionTypes, DEFAULT_SESSION_TYPES),
    sessionLocations: listText(
      saved.sessionLocations,
      configDefaults.sessionLocations,
      DEFAULT_SESSION_LOCATIONS
    )
  };
}

function saveConfig(nextConfig) {
  const previousSpreadsheetId = state.config.googleSpreadsheetId || "";
  state.config = { ...state.config, ...nextConfig };
  if ((state.config.googleSpreadsheetId || "") !== previousSpreadsheetId) {
    state.storageReadySpreadsheetId = "";
  }
  localStorage.setItem("clinic-manager-config", JSON.stringify(state.config));
}

function resetConfigToDefaults() {
  localStorage.removeItem("clinic-manager-config");
  state.config = loadConfig();
  state.storageReadySpreadsheetId = "";
}

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

function loadSyncQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]");
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}

function loadSyncState() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveSyncState() {
  localStorage.setItem(
    SYNC_STATE_KEY,
    JSON.stringify({
      saveState: state.saveState,
      lastSavedAt: state.lastSavedAt,
      lastRefreshAt: state.lastRefreshAt
    })
  );
  updateSyncIndicator();
}

function setSaveState(nextState) {
  state.saveState = nextState;
  if (nextState === "saved") state.lastSavedAt = new Date().toISOString();
  saveSyncState();
}

function persistSyncQueue() {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(state.syncQueue));
  updateSyncIndicator();
}

function queueSyncWork(kind, entityId, payload = {}) {
  const existing = state.syncQueue.find((item) => item.kind === kind && item.entityId === entityId);
  const now = new Date().toISOString();
  if (existing) {
    existing.payload = payload;
    existing.attempts = 0;
    existing.nextAttemptAt = Date.now();
    existing.lastError = "";
    existing.updatedAt = now;
  } else {
    state.syncQueue.push({
      id: id(),
      kind,
      entityId,
      payload,
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: "",
      createdAt: now,
      updatedAt: now
    });
  }
  state.saveState = "pending";
  persistSyncQueue();
  saveSyncState();
  scheduleSyncRetry(1000);
}

function removeSyncWork(itemId) {
  state.syncQueue = state.syncQueue.filter((item) => item.id !== itemId);
  if (!state.syncQueue.length) setSaveState("saved");
  persistSyncQueue();
}

function scheduleSyncRetry(delay = 5000) {
  if (syncRetryTimer) window.clearTimeout(syncRetryTimer);
  if (!state.syncQueue.length) return;
  syncRetryTimer = window.setTimeout(() => processSyncQueue().catch(() => {}), delay);
}

function syncStatusLabel() {
  if (syncProcessing) return "מסנכרן…";
  if (state.syncQueue.length) return `${state.syncQueue.length} פעולות ממתינות לסנכרון`;
  if (state.saveState === "saving") return "שומר…";
  if (state.saveState === "error") return "לא נשמר";
  if (state.lastSavedAt) return "נשמר";
  return "מוכן";
}

function formatDateTime(value) {
  if (!value) return "טרם בוצע";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );
}

function syncIndicatorBusy() {
  return (
    syncProcessing ||
    state.syncQueue.length > 0 ||
    state.saveState === "saving" ||
    state.saveState === "pending" ||
    state.saveState === "error"
  );
}

function updateSyncIndicatorVisibility() {
  const indicator = document.getElementById("syncStatus");
  if (syncIndicatorBusy()) {
    if (syncHideTimer) {
      window.clearTimeout(syncHideTimer);
      syncHideTimer = null;
    }
    syncIndicatorHidden = false;
    if (indicator) indicator.hidden = false;
    return;
  }
  if (syncIndicatorHidden) {
    if (indicator) indicator.hidden = true;
    return;
  }
  if (syncHideTimer) window.clearTimeout(syncHideTimer);
  syncHideTimer = window.setTimeout(() => {
    syncHideTimer = null;
    if (syncIndicatorBusy()) return;
    syncIndicatorHidden = true;
    const target = document.getElementById("syncStatus");
    if (target) target.hidden = true;
  }, 5000);
}

function updateSyncIndicator() {
  const label = document.querySelector("[data-sync-label]");
  const meta = document.querySelector("[data-sync-meta]");
  const retry = document.querySelector('[data-action="retry-sync"]');
  if (label) label.textContent = syncStatusLabel();
  if (meta) meta.textContent = `רענון אחרון: ${formatDateTime(state.lastRefreshAt)}`;
  if (retry) retry.hidden = !state.syncQueue.length;
  updateSyncIndicatorVisibility();
}

function updateUploadProgress(loaded, total, label = "מעלה קובץ…") {
  const percent = total ? Math.round((loaded / total) * 100) : 0;
  state.uploadProgress = { loaded, total, percent, label };
  const box = document.getElementById("uploadStatus");
  if (!box) return;
  box.hidden = false;
  const labelElement = box.querySelector("[data-upload-label]");
  const percentElement = box.querySelector("[data-upload-percent]");
  const bar = box.querySelector("[data-upload-bar]");
  if (labelElement) labelElement.textContent = label;
  if (percentElement) percentElement.textContent = `${percent}%`;
  if (bar) bar.style.width = `${percent}%`;
}

function clearUploadProgress() {
  state.uploadProgress = null;
  const box = document.getElementById("uploadStatus");
  if (box) box.hidden = true;
}

function optionValues(value, fallbackItems) {
  const items = String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items.length ? items : fallbackItems)];
}

function configuredEmails() {
  return optionValues(state.config.allowedUserEmails || "", []).map((email) => email.toLowerCase());
}

function isAuthorizedGoogleUser() {
  const allowedEmails = configuredEmails();
  if (!allowedEmails.length) return false;
  return Boolean(state.googleUser?.email && allowedEmails.includes(state.googleUser.email.toLowerCase()));
}

function canUseStorage() {
  return Boolean(state.accessToken && state.authChecked && isAuthorizedGoogleUser());
}

function selectOptions(items, selectedValue = "") {
  const options = selectedValue && !items.includes(selectedValue) ? [...items, selectedValue] : items;
  return [
    `<option value="">בחירה</option>`,
    ...options.map(
      (item) => `<option value="${html(item)}" ${item === selectedValue ? "selected" : ""}>${html(item)}</option>`
    )
  ].join("");
}

function loadStoredGoogleToken() {
  try {
    const legacyToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
    const stored = JSON.parse(sessionStorage.getItem(GOOGLE_TOKEN_KEY) || legacyToken || "null");
    localStorage.removeItem(GOOGLE_TOKEN_KEY);

    if (!stored?.accessToken || !stored?.expiresAt || Date.now() > stored.expiresAt) {
      clearStoredGoogleToken();
      return "";
    }

    googleTokenExpiresAt = Number(stored.expiresAt);
    if (legacyToken) sessionStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(stored));
    return stored.accessToken;
  } catch {
    clearStoredGoogleToken();
    return "";
  }
}

function clearStoredGoogleToken(resetConsent = false) {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
  googleTokenExpiresAt = 0;
  if (googleRefreshTimer) window.clearTimeout(googleRefreshTimer);
  googleRefreshTimer = null;
  if (resetConsent) {
    localStorage.removeItem(GOOGLE_CONSENT_KEY);
    localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
  }
}

function saveGoogleToken(response) {
  const expiresInSeconds = Number(response.expires_in || 3300);
  const expiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;
  const payload = JSON.stringify({
    accessToken: response.access_token,
    expiresAt
  });

  sessionStorage.setItem(GOOGLE_TOKEN_KEY, payload);
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  googleTokenExpiresAt = expiresAt;
  localStorage.setItem(GOOGLE_CONSENT_KEY, "yes");
  scheduleGoogleTokenRenewal();
}

function scheduleGoogleTokenRenewal() {
  if (googleRefreshTimer) window.clearTimeout(googleRefreshTimer);
  googleRefreshTimer = null;
  if (!googleTokenExpiresAt) return;
  const delay = Math.max(30_000, googleTokenExpiresAt - Date.now() - 5 * 60_000);
  googleRefreshTimer = window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      connectGoogle(false, true);
    } else {
      googleRefreshTimer = window.setTimeout(scheduleGoogleTokenRenewal, 60_000);
    }
  }, delay);
}

function googleCloudProjectNumber() {
  return (state.config.googleClientId || "").match(/^(\d+)-/)?.[1] || "";
}

function googleApiActivationUrl(serviceName) {
  const projectNumber = googleCloudProjectNumber();
  const service = encodeURIComponent(serviceName);
  return projectNumber
    ? `https://console.developers.google.com/apis/api/${service}/overview?project=${projectNumber}`
    : `https://console.cloud.google.com/apis/library/${service}`;
}

function googleOAuthClientUrl() {
  const clientId = state.config.googleClientId || "";
  const projectNumber = googleCloudProjectNumber();
  if (!clientId) return "https://console.cloud.google.com/apis/credentials";
  const projectQuery = projectNumber ? `?project=${encodeURIComponent(projectNumber)}` : "";
  return `https://console.cloud.google.com/apis/credentials/oauthclient/${encodeURIComponent(clientId)}${projectQuery}`;
}

function getRoute() {
  return location.hash.replace(/^#\/?/, "") || "dashboard";
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function id() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function rowToRecord(columns, row) {
  return Object.fromEntries(columns.map((column, index) => [column, row[index] || ""]));
}

function recordToRow(columns, record) {
  return columns.map((column) => String(record[column] || ""));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short" }).format(
    new Date(`${value}T00:00:00`)
  );
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

function hebcalCacheKey(year) {
  return `${HEBCAL_CACHE_PREFIX}-${year}`;
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
    yomtov: item?.yomtov === true
  };
}

function cachedIsraelHolidays(year, allowExpired = false) {
  try {
    const cached = JSON.parse(localStorage.getItem(hebcalCacheKey(year)) || "null");
    if (!cached || !Array.isArray(cached.items)) return null;
    if (!allowExpired && Date.now() - Number(cached.savedAt || 0) > HEBCAL_CACHE_MAX_AGE) return null;
    return cached.items.map(normalizeIsraelHoliday).filter((item) => item.date);
  } catch {
    return null;
  }
}

function storeIsraelHolidays(year, items) {
  try {
    localStorage.setItem(hebcalCacheKey(year), JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // Calendar data can still be used for the current session when browser storage is full.
  }
}

function mergeIsraelHolidays(year, items) {
  state.israelHolidays = [
    ...state.israelHolidays.filter((item) => !item.date.startsWith(`${year}-`)),
    ...items
  ].sort((a, b) => `${a.date} ${a.title}`.localeCompare(`${b.date} ${b.title}`, "he"));
  state.israelHolidayYears = [...new Set([...state.israelHolidayYears, year])];
}

async function loadIsraelHolidaysForYear(year) {
  if (state.israelHolidayYears.includes(year) || loadingIsraelHolidayYears.has(year)) return;
  loadingIsraelHolidayYears.add(year);
  const freshCache = cachedIsraelHolidays(year);

  if (freshCache) {
    mergeIsraelHolidays(year, freshCache);
    loadingIsraelHolidayYears.delete(year);
    return;
  }

  try {
    const params = new URLSearchParams({
      v: "1",
      cfg: "json",
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      i: "on",
      lg: "he",
      maj: "on",
      min: "on",
      mod: "on",
      mf: "on"
    });
    const response = await fetch(`${HEBCAL_API_URL}?${params}`);
    if (!response.ok) throw new Error(`Hebcal ${response.status}`);
    const payload = await response.json();
    const items = (payload.items || [])
      .filter((item) => item.category === "holiday" && item.date)
      .map(normalizeIsraelHoliday);
    storeIsraelHolidays(year, items);
    mergeIsraelHolidays(year, items);
    state.israelHolidayError = "";
  } catch {
    const staleCache = cachedIsraelHolidays(year, true);
    if (staleCache) {
      mergeIsraelHolidays(year, staleCache);
    } else {
      mergeIsraelHolidays(year, []);
      state.israelHolidayError = "לא היה ניתן לטעון את מועדי ישראל כרגע.";
    }
  } finally {
    loadingIsraelHolidayYears.delete(year);
  }
}

async function ensureIsraelHolidaysForMonth(monthValue) {
  const years = [...new Set(calendarDays(monthValue).map((day) => Number(day.date.slice(0, 4))))];
  const missingYears = years.filter(
    (year) => !state.israelHolidayYears.includes(year) && !loadingIsraelHolidayYears.has(year)
  );
  if (!missingYears.length) return;
  await Promise.all(missingYears.map(loadIsraelHolidaysForYear));
  if (state.route.split("/")[0] === "calendar") render();
}

function israelHolidaysForDate(dateValue) {
  return state.israelHolidays.filter((holiday) => holiday.date === dateValue);
}

function israelHolidayBlocksRecurring(dateValue) {
  return israelHolidaysForDate(dateValue).find((holiday) => holiday.yomtov);
}

function dateFromInput(value) {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function closePicker() {
  activePickerElement?.remove();
  activePickerElement = null;
}

function placePicker(popover, input) {
  document.body.appendChild(popover);
  const rect = input.getBoundingClientRect();
  const pickerRect = popover.getBoundingClientRect();
  const top = Math.min(rect.bottom + 6, window.innerHeight - pickerRect.height - 12);
  const preferredLeft = rect.right - pickerRect.width;
  const left = Math.max(
    12,
    Math.min(preferredLeft, window.innerWidth - pickerRect.width - 12)
  );
  popover.style.top = `${Math.max(12, top)}px`;
  popover.style.left = `${left}px`;
}

function showDatePicker(input, monthValue = "") {
  const baseDate = dateFromInput(input.value);
  const activeMonth = monthValue || isoDate(baseDate).slice(0, 7);
  const selectedDate = input.value || isoDate(baseDate);
  const days = calendarDays(activeMonth);
  const weekdays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
  closePicker();

  const popover = document.createElement("div");
  popover.className = "picker-popover date-popover";
  popover.dir = "rtl";
  popover.innerHTML = `
    <div class="picker-head">
      <button class="picker-nav" data-picker-prev type="button">‹</button>
      <strong>${html(monthLabel(activeMonth))}</strong>
      <button class="picker-nav" data-picker-next type="button">›</button>
    </div>
    <div class="date-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="date-grid">
      ${days
        .map(
          (day) => `
            <button class="date-option ${day.inMonth ? "" : "muted"} ${
              day.date === selectedDate ? "selected" : ""
            }" data-picker-date="${html(day.date)}" type="button">
              ${Number(day.date.slice(8, 10))}
            </button>`
        )
        .join("")}
    </div>`;

  popover.addEventListener("click", (event) => {
    event.stopPropagation();
    const previous = event.target.closest("[data-picker-prev]");
    const next = event.target.closest("[data-picker-next]");
    const dateButton = event.target.closest("[data-picker-date]");
    if (previous) showDatePicker(input, shiftMonth(activeMonth, -1));
    if (next) showDatePicker(input, shiftMonth(activeMonth, 1));
    if (dateButton) {
      input.value = dateButton.dataset.pickerDate;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      closePicker();
    }
  });

  activePickerElement = popover;
  placePicker(popover, input);
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

function clockButtonStyle(value, total, radius) {
  const angle = (value / total) * Math.PI * 2 - Math.PI / 2;
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);
  return `--x:${x.toFixed(3)}%;--y:${y.toFixed(3)}%;`;
}

function showTimePicker(input, selectedHour = null) {
  const current = timeParts(input.value);
  const hour = selectedHour ?? current.hour;
  const minute = current.minute;
  closePicker();

  const popover = document.createElement("div");
  popover.className = "picker-popover time-popover";
  popover.dir = "rtl";
  popover.innerHTML = `
    <div class="picker-head">
      <strong>בחירת שעה</strong>
      <span>${String(hour).padStart(2, "0")}:${minute}</span>
    </div>
    <div class="time-clock" aria-label="שעון 24 שעות">
      ${Array.from({ length: 24 }, (_, clockHour) => {
        const label = String(clockHour).padStart(2, "0");
        return `
          <button class="clock-hour ${clockHour === hour ? "selected" : ""}" style="${clockButtonStyle(
            clockHour,
            24,
            43
          )}" data-picker-hour="${clockHour}" type="button">${label}</button>`;
      }).join("")}
      ${["00", "15", "30", "45"]
        .map(
          (clockMinute, index) => `
            <button class="clock-minute ${clockMinute === minute ? "selected" : ""}" style="${clockButtonStyle(
              index,
              4,
              22
            )}" data-picker-minute="${clockMinute}" type="button">${clockMinute}</button>`
        )
        .join("")}
      <div class="clock-center">${String(hour).padStart(2, "0")}:${minute}</div>
    </div>`;

  popover.addEventListener("click", (event) => {
    event.stopPropagation();
    const hourButton = event.target.closest("[data-picker-hour]");
    const minuteButton = event.target.closest("[data-picker-minute]");
    if (hourButton) {
      showTimePicker(input, Number(hourButton.dataset.pickerHour));
      return;
    }
    if (minuteButton) {
      input.value = `${String(hour).padStart(2, "0")}:${minuteButton.dataset.pickerMinute}`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      closePicker();
    }
  });

  activePickerElement = popover;
  placePicker(popover, input);
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

function icon(name) {
  const common =
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const icons = {
    dashboard: `<svg ${common}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M12 13l4-4"/><path d="M6.5 19h11"/></svg>`,
    patients: `<svg ${common}><path d="M16 19v-1a4 4 0 0 0-8 0v1"/><circle cx="12" cy="8" r="3"/><path d="M19 19v-1.2a3 3 0 0 0-2-2.8"/><path d="M17 5.4a2.5 2.5 0 0 1 0 5.2"/></svg>`,
    calendar: `<svg ${common}><rect height="16" rx="2" width="18" x="3" y="5"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/></svg>`,
    tasks: `<svg ${common}><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/></svg>`,
    payments: `<svg ${common}><rect height="14" rx="2" width="18" x="3" y="5"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>`,
    business: `<svg ${common}><rect height="13" rx="2" width="18" x="3" y="7"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>`,
    reports: `<svg ${common}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16V9"/><path d="M13 16V7"/><path d="M18 16v-5"/></svg>`,
    files: `<svg ${common}><path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>`,
    settings: `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2.1.4l-.1.1h-4l-.1-.1a1.8 1.8 0 0 0-2.1-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2"/></svg>`
  };
  return icons[name] || "";
}

function activeKey() {
  if (state.route.startsWith("patients")) return "patients";
  if (state.route === "settings") return "settings";
  return state.route || "dashboard";
}

function syncIndicator() {
  return `
    <div class="sync-indicator ${state.syncQueue.length ? "pending" : state.saveState}" id="syncStatus" role="status" aria-live="polite" ${syncIndicatorHidden && !syncIndicatorBusy() ? "hidden" : ""}>
      <strong data-sync-label>${html(syncStatusLabel())}</strong>
      <span data-sync-meta>רענון אחרון: ${html(formatDateTime(state.lastRefreshAt))}</span>
      <button class="button secondary table-button" data-action="retry-sync" type="button" ${state.syncQueue.length ? "" : "hidden"}>נסה שוב עכשיו</button>
    </div>`;
}

function uploadProgressBar() {
  const progress = state.uploadProgress;
  const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));
  return `
    <div class="upload-progress" id="uploadStatus" role="status" aria-live="polite" ${progress ? "" : "hidden"}>
      <div class="upload-progress-copy">
        <strong data-upload-label>${html(progress?.label || "מעלה קובץ…")}</strong>
        <span data-upload-percent>${percent}%</span>
      </div>
      <div class="upload-track"><span data-upload-bar style="width:${percent}%"></span></div>
      <button class="button danger table-button" data-action="cancel-upload" type="button">ביטול העלאה</button>
    </div>`;
}

function shell(content) {
  const nav = [
    ["dashboard", "dashboard", "דשבורד"],
    ["patients", "patients", "מטופלים"],
    ["calendar", "calendar", "יומן"],
    ["tasks", "tasks", "משימות"],
    ["payments", "payments", "תשלומים"],
    ["business", "business", "ניהול עסק"],
    ["reports", "reports", "דוחות"],
    ["files", "files", "קבצים"],
    ["settings", "settings", "הגדרות"]
  ]
    .map(
      ([key, iconName, label]) => `
        <a class="side-link ${activeKey() === key ? "active" : ""}" href="#/${key}" ${activeKey() === key ? 'aria-current="page"' : ""}>
          <span class="side-glyph">${icon(iconName)}</span>
          <span>${label}</span>
        </a>`
    )
    .join("");

  return `
    <div class="app-shell">
      <aside class="side-nav" aria-label="ניווט במערכת">
        <div class="side-brand">
          <img class="side-brand-logo" src="./assets/malka-logo.png" alt="מלכה זיידמן" />
          <span>מלכה זיידמן</span>
          <small>ניהול קליניקה</small>
        </div>
        <nav class="side-menu" aria-label="ניווט ראשי">${nav}</nav>
        ${
          state.accessToken
            ? `<button class="side-signout" data-action="disconnect-google" type="button">התנתקות</button>`
            : ""
        }
      </aside>
      <main class="main">
        ${syncIndicator()}
        ${uploadProgressBar()}
        ${state.error ? `<div class="message error" role="alert" aria-live="assertive">${html(state.error)}</div>` : ""}
        ${state.message ? `<div class="message" role="status" aria-live="polite">${html(state.message)}${state.lastUndoActionId ? ` <button class="button secondary message-action" data-action="undo-last-action" data-id="${html(state.lastUndoActionId)}" type="button">ביטול הפעולה</button>` : ""}</div>` : ""}
        ${content}
      </main>
    </div>`;
}

function connectionBanner() {
  if (state.accessToken) return "";
  const connecting = googleAuthInFlight || state.authRestoring;
  return `
    <div class="message" role="status" aria-live="polite">
      ${connecting ? "ממתינים לאישור בחלון Google…" : "יש להתחבר לאחסון כדי לקרוא ולשמור נתונים."}
      <button class="button blue" data-action="connect-google" type="button" ${connecting ? "disabled" : ""}>${connecting ? "מתחבר…" : "התחברות לאחסון"}</button>
    </div>`;
}

function accessGatePage() {
  const allowedEmails = configuredEmails();
  const connectedEmail = state.googleUser?.email || "";
  const rememberedEmail = localStorage.getItem(GOOGLE_ACCOUNT_KEY) || "";
  const subtitle = state.authRestoring
    ? "משחזרים את החיבור המאובטח לחשבון Google..."
    : state.accessToken
    ? "החשבון המחובר נבדק לפני טעינת הנתונים."
    : "יש להתחבר לחשבון Google מורשה כדי לעבוד עם נתוני הקליניקה.";
  const details = state.accessToken && connectedEmail
    ? "חשבון Google מחובר ונמצא בבדיקה."
    : rememberedEmail && localStorage.getItem(GOOGLE_CONSENT_KEY) === "yes"
      ? "נמצא חיבור Google שמור במכשיר הזה."
    : allowedEmails.length
      ? "הכניסה מוגבלת לחשבונות Google שאושרו מראש."
      : "לא הוגדרה רשימת מורשים. הגישה לנתונים חסומה עד להגדרת חשבון מורשה.";

  const connectAction = state.authRestoring || googleAuthInFlight
    ? `<button class="button blue" disabled type="button">מתחבר…</button>`
    : `<button class="button blue" data-action="connect-google" type="button">התחברות לחשבון מורשה</button>`;

  return shell(`
    ${header("כניסה למערכת", subtitle, connectAction)}
    <section class="panel">
      <div class="empty">
        <div>
          <strong>${html(details)}</strong>
          <a class="button secondary" href="#/settings">הגדרות</a>
        </div>
      </div>
    </section>
  `);
}

function header(title, subtitle, actions = "") {
  return `
    <section class="header">
      <div>
        <h1>${html(title)}</h1>
        ${subtitle ? `<p>${html(subtitle)}</p>` : ""}
      </div>
      <div class="toolbar">${actions}</div>
    </section>`;
}

function dashboardPage() {
  const openPayments = state.payments.filter((payment) => payment.payment_status !== "paid").length;
  const activePatients = state.patients.filter((patient) => patient.status !== "archived").length;
  const today = isoDate(new Date());
  const todayRows = sessionsForDates([today]);
  const weekRows = sessionsForDates(dateRange(today, 7));
  const todaySessions = todayRows.length;
  const reminderCount = activeReminders().length;

  return shell(`
    ${header(
      "תמונת מצב יומית",
      "",
      `<button class="button" data-action="open-patient-drawer" type="button">מטופל חדש +</button>`
    )}
    ${connectionBanner()}
    <section class="kpi-grid">
      <article class="kpi-card blue-card"><div><strong>${todaySessions}</strong><span>מפגשים היום</span></div><span class="kpi-symbol">${icon("calendar")}</span></article>
      <article class="kpi-card teal-card"><div><strong>${reminderCount}</strong><span>תזכורות פעילות</span></div><span class="kpi-symbol">${icon("tasks")}</span></article>
      <article class="kpi-card pink-card"><div><strong>${openPayments}</strong><span>תשלומים פתוחים</span></div><span class="kpi-symbol">${icon("payments")}</span></article>
      <article class="kpi-card purple-card"><div><strong>${activePatients}</strong><span>מטופלים פעילים</span></div><span class="kpi-symbol">${icon("patients")}</span></article>
    </section>
    <section class="dashboard-grid">
      <div class="dashboard-full">${remindersPanel()}</div>
      ${sessionsPanel(weekRows)}
      ${paymentsPanel()}
      <div class="dashboard-full">${tasksPanel()}</div>
    </section>
    ${patientDrawer()}
  `);
}

function patientsPage() {
  const filters = state.patientFilter;
  const includes = (value, filter) =>
    !filter || String(value || "").toLowerCase().includes(filter.toLowerCase());
  const filteredPatients = state.patients.filter(
    (patient) =>
      includes(patient.child_name, filters.name) &&
      includes(patient.school_name, filters.school) &&
      includes(patient.treatment_type, filters.treatment) &&
      includes(paymentStatusLabel(patient.payment_status), filters.status)
  );

  return shell(`
    ${header(
      "מטופלים",
      "",
      `<button class="button" data-action="open-patient-drawer" type="button">הוסף מטופל +</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>
       <a class="button yellow" href="#/settings">הגדרות</a>`
    )}
    ${connectionBanner()}
    <section class="panel">
      <div class="panel-head count-only"><span>${filteredPatients.length} מתוך ${state.patients.length}</span></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>שם</th>
              <th>אימייל / מוסד</th>
              <th>טלפון / טיפול</th>
              <th>תשלום</th>
              <th>פעולות</th>
            </tr>
            <tr class="filters">
              <td><input class="table-filter" aria-label="חיפוש מטופל לפי שם" placeholder="חיפוש שם" data-patient-filter="name" value="${html(filters.name)}" /></td>
              <td><input class="table-filter" aria-label="סינון לפי מוסד" placeholder="מוסד" data-patient-filter="school" value="${html(filters.school)}" /></td>
              <td><input class="table-filter" aria-label="סינון לפי סוג טיפול" placeholder="סוג טיפול" data-patient-filter="treatment" value="${html(filters.treatment)}" /></td>
              <td><input class="table-filter" aria-label="סינון לפי סטטוס" placeholder="סטטוס" data-patient-filter="status" value="${html(filters.status)}" /></td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            ${filteredPatients
              .map(
                (patient) => `
                <tr>
                  <td>
                    <strong>${html(patient.child_name)}</strong>
                    ${patient.status === "archived" ? `<span class="status-pill muted">ארכיון</span>` : ""}
                  </td>
                  <td>${html(patient.school_name || "-")}</td>
                  <td>${html(patient.treatment_type || "-")}</td>
                  <td><span class="status-pill">${html(paymentStatusLabel(patient.payment_status))}</span></td>
                  <td>
                    <div class="actions">
                      <button class="small-action" data-action="open-profile" data-id="${html(patient.id)}" type="button" aria-label="פתיחת כרטיס מטופל" title="פתיחת כרטיס מטופל">↗</button>
                      <button class="small-action edit" data-action="open-patient-drawer" data-id="${html(patient.id)}" type="button" aria-label="עריכת מטופל" title="עריכת מטופל">✎</button>
                      <button class="small-action danger" data-action="toggle-patient-archive" data-id="${html(patient.id)}" data-archive="${patient.status === "archived" ? "restore" : "archive"}" type="button" aria-label="${patient.status === "archived" ? "החזרה מארכיון" : "ארכוב"}" title="${patient.status === "archived" ? "החזרה מארכיון" : "ארכוב"}">${patient.status === "archived" ? "↩" : "↓"}</button>
                    </div>
                  </td>
                </tr>`
              )
              .join("") || `<tr><td colspan="5"><div class="empty">אין מטופלים להצגה.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    ${patientDrawer()}
  `);
}

function profilePage(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return shell(`${header("כרטיס לא נמצא", "ייתכן שהמטופל נמחק או שעדיין לא נטענו נתונים.", `<a class="button secondary" href="#/patients">חזרה</a>`)}`);

  const sessions = state.sessions.filter((session) => session.patient_id === patient.id);
  const payments = state.payments.filter((payment) => payment.patient_id === patient.id);
  const tasks = state.tasks.filter((task) => task.patient_id === patient.id);
  const files = state.files.filter((file) => file.patient_id === patient.id);
  const contacts = state.contacts.filter((contact) => contact.patient_id === patient.id);
  const goals = state.goals.filter((goal) => goal.patient_id === patient.id);
  const assignments = state.questionnaireAssignments.filter((assignment) => assignment.patient_id === patient.id);
  const clinicalReports = state.clinicalReports.filter((report) => report.patient_id === patient.id);
  const tab = profileTabKey();

  return shell(`
    ${header(
      patient.child_name,
      `${patient.treatment_type || "סוג טיפול לא הוגדר"} | ${patient.fixed_day || "ללא יום קבוע"} ${patient.fixed_time || ""}`,
      `<a class="button secondary" href="#/patients">חזרה לרשימה</a>`
    )}
    <section class="profile">
      ${profileTabs(tab)}
      <section class="profile-tab-body">
        ${tab === "overview" ? profileOverviewPanel(patient) : ""}
        ${tab === "documentation" ? sessionsPanel(sessions, patient.id) : ""}
        ${tab === "payments" ? paymentsPanel(payments, patient.id) : ""}
        ${tab === "tasks" ? tasksPanel(tasks, patient.id) : ""}
        ${tab === "files" ? filesPanel(files, patient) : ""}
        ${tab === "contacts" ? contactsPanel(contacts, patient.id) : ""}
        ${tab === "goals" ? goalsPanel(goals, patient.id) : ""}
        ${tab === "questionnaires" ? questionnairesPanel(assignments, patient.id) : ""}
        ${tab === "clinical-reports" ? clinicalReportsPanel(clinicalReports, patient.id) : ""}
      </section>
    </section>
  `);
}

function profileTabKey() {
  const allowedTabs = ["overview", "contacts", "goals", "questionnaires", "documentation", "clinical-reports", "payments", "tasks", "files"];
  return allowedTabs.includes(state.profileTab) ? state.profileTab : "overview";
}

function profileTabs(activeTab) {
  const tabs = [
    ["overview", "פרטים"],
    ["contacts", "הורים ואנשי מקצוע"],
    ["goals", "מטרות"],
    ["questionnaires", "שאלונים"],
    ["documentation", "תיעוד מפגש"],
    ["clinical-reports", "דוחות טיפוליים"],
    ["payments", "תשלומים"],
    ["tasks", "משימות"],
    ["files", "קבצים"]
  ];
  return `
    <nav class="profile-tabs" aria-label="ניווט בכרטיס מטופל">
      ${tabs
        .map(
          ([key, label]) => `
            <button class="profile-tab ${activeTab === key ? "active" : ""}" data-action="profile-tab" data-tab="${key}" type="button">
              ${label}
            </button>`
        )
        .join("")}
    </nav>`;
}

function profileOverviewPanel(patient) {
  return `
    <article class="panel compact-panel">
      <div class="panel-head"><h2>פרטים כלליים</h2></div>
      <div class="detail-list detail-grid">
        ${detail("שם", patient.child_name)}
        ${detail("מוסד לימודים", patient.school_name)}
        ${detail("סוג טיפול", patient.treatment_type)}
        ${detail("יום קבוע", patient.fixed_day)}
        ${detail("שעה קבועה", patient.fixed_time)}
        ${detail("מחיר קבוע", patient.fixed_price)}
      </div>
    </article>`;
}

function safeJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function goalStatusLabel(value) {
  return { planned: "מתוכננת", active: "פעילה", achieved: "הושגה", paused: "הושהתה" }[value] || "פעילה";
}

function goalsPanel(goals, patientId) {
  const editedGoal = state.currentGoalId ? goals.find((goal) => goal.id === state.currentGoalId) : null;
  const ordered = [...goals].sort((a, b) => `${a.status === "active" ? "0" : "1"}${b.updated_at || ""}`.localeCompare(`${b.status === "active" ? "0" : "1"}${a.updated_at || ""}`));
  return `
    <section class="grid-two profile-grid">
      <article class="panel">
        <div class="panel-head"><h2>${editedGoal ? "עריכת מטרה" : "מטרה חדשה"}</h2></div>
        <form class="form-grid inline-form" data-form="goal" data-patient-id="${html(patientId)}" data-id="${html(editedGoal?.id || "")}">
          <div class="field wide"><label for="goal_title">כותרת</label><input id="goal_title" name="title" required value="${html(editedGoal?.title || "")}" /></div>
          <div class="field wide"><label for="goal_description">פירוט</label><textarea id="goal_description" name="description">${html(editedGoal?.description || "")}</textarea></div>
          <div class="field"><label for="goal_status">מצב</label><select id="goal_status" name="status">
            ${["planned", "active", "achieved", "paused"].map((value) => `<option value="${value}" ${value === (editedGoal?.status || "active") ? "selected" : ""}>${goalStatusLabel(value)}</option>`).join("")}
          </select></div>
          <div class="field"><label for="goal_progress">התקדמות</label><input id="goal_progress" name="progress" type="number" min="0" max="100" value="${html(editedGoal?.progress || "0")}" /></div>
          <div class="field"><label for="goal_target_date">תאריך יעד</label><input class="picker-input" data-date-input id="goal_target_date" name="target_date" readonly value="${html(editedGoal?.target_date || "")}" /></div>
          <div class="field wide"><label for="goal_note">הערה</label><textarea id="goal_note" name="note">${html(editedGoal?.note || "")}</textarea></div>
          <div class="toolbar wide"><button class="button" type="submit">${editedGoal ? "עדכון מטרה" : "שמירת מטרה"}</button>${editedGoal ? `<button class="button secondary" data-action="cancel-goal-edit" type="button">ביטול</button>` : ""}</div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>מטרות טיפול</h2><span>${ordered.length} מטרות</span></div>
        <div class="report-list">
          ${ordered.map((goal) => {
            const updates = state.goalUpdates.filter((update) => update.goal_id === goal.id).sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
            return `<article class="report-item">
              <strong>${html(goal.title)}</strong>
              <span>${html(goalStatusLabel(goal.status))} · ${html(goal.progress || "0")}%${goal.target_date ? ` · יעד ${html(formatDate(goal.target_date))}` : ""}</span>
              ${goal.description ? `<p>${html(goal.description)}</p>` : ""}
              ${updates[0] ? `<small>עדכון אחרון: ${html(updates[0].progress || "0")}%${updates[0].note ? ` · ${html(updates[0].note)}` : ""}</small>` : ""}
              <button class="button secondary table-button" data-action="edit-goal" data-id="${html(goal.id)}" type="button">עריכה</button>
            </article>`;
          }).join("") || `<div class="empty">עדיין לא הוגדרו מטרות טיפול.</div>`}
        </div>
      </article>
    </section>`;
}

function questionnaireStatusLabel(value) {
  return { draft: "טיוטה", sent: "נשלח", completed: "הושלם", closed: "נסגר" }[value] || "טיוטה";
}

function questionnaireAnswersView(assignment) {
  const response = state.questionnaireResponses.find((item) => item.assignment_id === assignment.id);
  const answers = safeJson(response?.answers_json, []);
  if (!answers.length) return "";
  return `<details class="settings-help"><summary>הצגת תשובות</summary>${answers.map((answer) => `<p><strong>${html(answer.question || "שאלה")}</strong><br />${html(answer.answer || "-")}</p>`).join("")}</details>`;
}

function questionnairesPanel(assignments, patientId) {
  const contacts = state.contacts.filter((contact) => contact.patient_id === patientId);
  const activeTemplates = state.questionnaireTemplates.filter((template) => template.active !== "no");
  const selectedTemplate = state.questionnaireTemplates.find((template) => template.id === state.currentQuestionnaireTemplateId) || activeTemplates[0] || state.questionnaireTemplates[0];
  const questionsText = safeJson(selectedTemplate?.questions_json, []).map((question) => question.title || "").join("\n");
  return `
    <section class="grid-two profile-grid">
      <article class="panel">
        <div class="panel-head"><h2>שליחת שאלון</h2></div>
        <form class="form-grid inline-form" data-form="questionnaire-assignment" data-patient-id="${html(patientId)}">
          <div class="field wide"><label for="questionnaire_contact">נמען</label><select id="questionnaire_contact" name="contact_id" required><option value="">בחירה</option>${contacts.map((contact) => `<option value="${html(contact.id)}">${html(contact.name)} · ${html(contact.relationship || contact.contact_type || "")}</option>`).join("")}</select></div>
          <div class="field wide"><label for="questionnaire_template">תבנית</label><select id="questionnaire_template" name="template_id" required><option value="">בחירה</option>${activeTemplates.map((template) => `<option value="${html(template.id)}">${html(template.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="questionnaire_due">מועד רצוי</label><input class="picker-input" data-date-input id="questionnaire_due" name="due_date" readonly /></div>
          <div class="toolbar wide"><button class="button blue" type="submit" ${contacts.length && activeTemplates.length ? "" : "disabled"}>יצירת שאלון וקישור</button></div>
        </form>
        ${!contacts.length ? `<div class="empty">כדי לשלוח שאלון צריך להוסיף קודם הורה או איש מקצוע.</div>` : ""}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>תבניות שאלון</h2></div>
        <div class="field"><label for="questionnaire_template_editor_select">בחירת תבנית לעריכה</label><select id="questionnaire_template_editor_select" data-questionnaire-template-select>${state.questionnaireTemplates.map((template) => `<option value="${html(template.id)}" ${template.id === selectedTemplate?.id ? "selected" : ""}>${html(template.name)}</option>`).join("")}</select></div>
        <form class="form-grid inline-form" data-form="questionnaire-template" data-id="${html(selectedTemplate?.id || "")}">
          <div class="field"><label for="questionnaire_template_name">שם</label><input id="questionnaire_template_name" name="name" required value="${html(selectedTemplate?.name || "")}" /></div>
          <div class="field"><label for="questionnaire_audience">מיועד ל</label><select id="questionnaire_audience" name="audience"><option value="parent" ${selectedTemplate?.audience === "parent" ? "selected" : ""}>הורים</option><option value="professional" ${selectedTemplate?.audience === "professional" ? "selected" : ""}>אנשי מקצוע</option></select></div>
          <div class="field wide"><label for="questionnaire_questions">שאלות — שאלה אחת בכל שורה</label><textarea id="questionnaire_questions" name="questions_text" rows="10">${html(questionsText)}</textarea></div>
          <div class="toolbar wide"><button class="button" type="submit">שמירת תבנית</button></div>
        </form>
      </article>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>שאלונים שנשלחו</h2><button class="button secondary" data-action="sync-questionnaires" data-patient-id="${html(patientId)}" type="button">רענון תשובות</button></div>
      <div class="report-list">${[...assignments].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`)).map((assignment) => {
        const contact = state.contacts.find((item) => item.id === assignment.contact_id);
        const template = state.questionnaireTemplates.find((item) => item.id === assignment.template_id);
        return `<article class="report-item"><strong>${html(template?.name || "שאלון")}</strong><span>${html(contact?.name || "נמען לא ידוע")} · ${html(questionnaireStatusLabel(assignment.status))}</span>
          <div class="toolbar"><button class="button green table-button" data-action="send-questionnaire-whatsapp" data-id="${html(assignment.id)}" type="button" ${contact?.phone && assignment.responder_url ? "" : "disabled"}>WhatsApp</button><button class="button secondary table-button" data-action="send-questionnaire-email" data-id="${html(assignment.id)}" type="button" ${contact?.email && assignment.responder_url ? "" : "disabled"}>מייל</button>${assignment.responder_url ? `<a class="button secondary table-button" href="${html(assignment.responder_url)}" target="_blank" rel="noopener">פתיחת טופס</a>` : ""}</div>${questionnaireAnswersView(assignment)}</article>`;
      }).join("") || `<div class="empty">עדיין לא נשלחו שאלונים.</div>`}</div>
    </section>`;
}

function reportTypeLabel(value) {
  return REPORT_TYPES[value] || REPORT_TYPES.progress;
}

function clinicalReportDraft(patientId, reportType = "progress", start = "", end = "") {
  const patient = state.patients.find((item) => item.id === patientId);
  const sessions = state.sessions.filter((session) => session.patient_id === patientId && (!start || session.session_date >= start) && (!end || session.session_date <= end));
  const goals = state.goals.filter((goal) => goal.patient_id === patientId);
  const responses = state.questionnaireResponses.filter((response) => response.patient_id === patientId);
  const lines = [
    reportTypeLabel(reportType),
    `שם המטופל: ${patient?.child_name || ""}`,
    `סוג טיפול: ${patient?.treatment_type || ""}`,
    start || end ? `תקופה: ${start ? formatDate(start) : ""} - ${end ? formatDate(end) : ""}` : "",
    "",
    "מטרות טיפול:",
    ...goals.map((goal) => `- ${goal.title}: ${goalStatusLabel(goal.status)}, התקדמות ${goal.progress || 0}%${goal.description ? ` — ${goal.description}` : ""}`),
    "",
    "מהלך הטיפול:",
    ...sessions.map((session) => `${formatDate(session.session_date)} — ${session.summary || "לא נכתב סיכום"}`),
    "",
    "מידע משאלונים:",
    ...responses.flatMap((response) => safeJson(response.answers_json, []).map((answer) => `- ${answer.question}: ${answer.answer || "-"}`)),
    "",
    reportType === "assessment" ? "ממצאי האבחון והמלצות:" : reportType === "summary" ? "סיכום והמלצות להמשך:" : "הערכת התקדמות והמלצות להמשך:",
    ""
  ];
  return lines.filter((line, index) => line || index > 0).join("\n");
}

function clinicalReportsPanel(reports, patientId) {
  return `
    <section class="grid-two profile-grid">
      <article class="panel"><div class="panel-head"><h2>הפקת דוח טיפולי</h2></div>
        <form class="form-grid inline-form" data-form="clinical-report" data-patient-id="${html(patientId)}">
          <div class="field"><label for="clinical_report_type">סוג דוח</label><select id="clinical_report_type" name="report_type">${Object.entries(REPORT_TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
          <div class="field"><label for="clinical_report_title">כותרת</label><input id="clinical_report_title" name="title" placeholder="תיווצר אוטומטית אם יישאר ריק" /></div>
          <div class="field"><label for="clinical_period_start">מתאריך</label><input class="picker-input" data-date-input id="clinical_period_start" name="period_start" readonly /></div>
          <div class="field"><label for="clinical_period_end">עד תאריך</label><input class="picker-input" data-date-input id="clinical_period_end" name="period_end" readonly /></div>
          <div class="field wide"><label for="clinical_report_content">תוכן לעריכה</label><textarea id="clinical_report_content" name="content" rows="18">${html(clinicalReportDraft(patientId))}</textarea><small>הערות פנימיות אינן נכללות בטיוטה.</small></div>
          <div class="toolbar wide"><button class="button blue" type="submit">יצירת Google Doc ו-PDF</button></div>
        </form>
      </article>
      <article class="panel"><div class="panel-head"><h2>דוחות שהופקו</h2><span>${reports.length}</span></div><div class="report-list">
        ${[...reports].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`)).map((report) => `<article class="report-item"><strong>${html(report.title || reportTypeLabel(report.report_type))}</strong><span>${html(reportTypeLabel(report.report_type))} · ${html(formatDate((report.created_at || "").slice(0, 10)))}</span><div class="toolbar">${report.document_file_id ? `<a class="button secondary table-button" href="${html(driveFileUrl(report.document_file_id))}" target="_blank" rel="noopener">Google Doc</a>` : ""}${report.pdf_file_id ? `<a class="button secondary table-button" href="${html(driveFileUrl(report.pdf_file_id))}" target="_blank" rel="noopener">PDF</a>` : ""}</div></article>`).join("") || `<div class="empty">עדיין לא הופקו דוחות טיפוליים.</div>`}
      </div></article>
    </section>`;
}

function settingsPage() {
  const currentOrigin = window.location.origin;
  const activeClientId = state.config.googleClientId || "לא הוגדר";
  const connectionAction = state.accessToken
    ? `<button class="button secondary" data-action="disconnect-google" type="button">התנתקות מהמכשיר</button>`
    : `<button class="button blue" data-action="connect-google" type="button" ${googleAuthInFlight || state.authRestoring ? "disabled" : ""}>${googleAuthInFlight || state.authRestoring ? "מתחבר…" : "התחברות לאחסון"}</button>`;
  return shell(`
    ${header("הגדרות", "", connectionAction)}
    <section class="grid-two settings-grid">
      <article class="panel settings-panel">
        <div class="panel-head"><h2>פרטי חיבור</h2></div>
        <form class="form-grid settings-form" data-form="settings">
          <div class="field settings-full">
            <label for="googleClientId">מזהה התחברות</label>
            <input id="googleClientId" name="googleClientId" value="${html(state.config.googleClientId)}" title="${html(state.config.googleClientId)}" placeholder="xxxx.apps.googleusercontent.com" />
          </div>
          <div class="field">
            <label for="googleSpreadsheetId">מזהה מאגר נתונים</label>
            <input id="googleSpreadsheetId" name="googleSpreadsheetId" value="${html(state.config.googleSpreadsheetId)}" title="${html(state.config.googleSpreadsheetId)}" />
          </div>
          <div class="field">
            <label for="googleDriveRootFolderId">תיקיית אחסון ראשית</label>
            <input id="googleDriveRootFolderId" name="googleDriveRootFolderId" value="${html(state.config.googleDriveRootFolderId)}" title="${html(state.config.googleDriveRootFolderId)}" />
          </div>
          <div class="field">
            <label for="googleTemplatesFolderId">תיקיית תבניות</label>
            <input id="googleTemplatesFolderId" name="googleTemplatesFolderId" value="${html(state.config.googleTemplatesFolderId)}" title="${html(state.config.googleTemplatesFolderId)}" />
          </div>
          <div class="field">
            <label for="googleCalendarId">יומן לסנכרון מפגשים</label>
            <input id="googleCalendarId" name="googleCalendarId" value="${html(state.config.googleCalendarId)}" title="${html(state.config.googleCalendarId)}" placeholder="primary" />
          </div>
          <div class="field settings-full">
            <label for="allowedUserEmails">חשבונות Google מורשים</label>
            <textarea id="allowedUserEmails" name="allowedUserEmails" placeholder="כתובת Google אחת בכל שורה">${html(state.config.allowedUserEmails)}</textarea>
          </div>
          <div class="field">
            <label for="sessionTypes">סוגי מפגש</label>
            <textarea id="sessionTypes" name="sessionTypes" placeholder="כל שורה היא אפשרות ברשימה">${html(state.config.sessionTypes)}</textarea>
          </div>
          <div class="field">
            <label for="sessionLocations">מיקומים למפגש</label>
            <textarea id="sessionLocations" name="sessionLocations" placeholder="כל שורה היא אפשרות ברשימה">${html(state.config.sessionLocations)}</textarea>
          </div>
          <div class="toolbar settings-full">
            <button class="button" type="submit">שמירת הגדרות</button>
          </div>
        </form>
      </article>
      <article class="panel settings-panel settings-status-panel">
        <div class="panel-head"><h2>מצב</h2></div>
        <div class="settings-card">
          <p><strong>חיבור:</strong> ${state.accessToken ? "מחובר כרגע." : "לא מחובר כרגע."}</p>
          <p><strong>חשבון:</strong> ${state.googleUser?.email ? html(state.googleUser.email) : "לא זוהה עדיין."}</p>
          <p><strong>הרשאה:</strong> ${state.accessToken && state.authChecked ? (isAuthorizedGoogleUser() ? "מורשה." : "לא מורשה.") : "תיבדק אחרי התחברות."}</p>
          <p><strong>כניסה חוזרת:</strong> ${localStorage.getItem(GOOGLE_CONSENT_KEY) === "yes" ? "חיבור אוטומטי מופעל במכשיר הזה." : "יופעל לאחר ההתחברות הראשונה."}</p>
          <label class="diagnostic-field" for="currentGoogleOrigin">
            <span>מקור נוכחי ל-Google</span>
            <input id="currentGoogleOrigin" readonly value="${html(currentOrigin)}" />
          </label>
          <label class="diagnostic-field" for="activeGoogleClientId">
            <span>Client ID בפועל</span>
            <input id="activeGoogleClientId" readonly value="${html(activeClientId)}" />
          </label>
          <div class="diagnostic-actions settings-primary-actions">
            <button class="button blue" data-action="check-storage" type="button">בדיקת חיבור</button>
            <button class="button secondary" data-action="force-connect-google" type="button">התחברות מחדש עם הרשאות</button>
            <button class="button secondary" data-action="reset-google-settings" type="button">איפוס הגדרות Google לברירת המחדל</button>
          </div>
          <div class="diagnostic-actions">
            <a class="button yellow" href="${html(googleOAuthClientUrl())}" target="_blank" rel="noopener">עריכת OAuth Client</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("sheets.googleapis.com"))}" target="_blank" rel="noopener">הפעלת מאגר נתונים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("drive.googleapis.com"))}" target="_blank" rel="noopener">הפעלת אחסון קבצים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("calendar.googleapis.com"))}" target="_blank" rel="noopener">הפעלת יומן</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("docs.googleapis.com"))}" target="_blank" rel="noopener">הפעלת מסמכים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("forms.googleapis.com"))}" target="_blank" rel="noopener">הפעלת שאלונים</a>
          </div>
          <details class="settings-help">
            <summary>עזרה בתקלות חיבור</summary>
            <p>בשגיאת origin_mismatch יש להוסיף ב-Google Cloud את המקור שמופיע למעלה, תחת Authorized JavaScript origins של ה-Client ID.</p>
            <p>אם בדיקת החיבור נכשלת, מפעילים את הרכיב המתאים וחוזרים להתחברות מחדש עם הרשאות.</p>
          </details>
        </div>
      </article>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>יומן פעילות וביטול</h2></div>
      ${auditLogView()}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>גיבוי וייצוא</h2></div>
      <div class="toolbar">
        <button class="button blue" data-action="download-backup" type="button">הורדת גיבוי מלא</button>
        <button class="button" data-action="save-backup-drive" type="button">שמירת גיבוי באחסון</button>
        <button class="button secondary" data-action="export-table" data-table="patients" type="button">ייצוא מטופלים</button>
        <button class="button secondary" data-action="export-table" data-table="payments" type="button">ייצוא תשלומים</button>
        <button class="button secondary" data-action="export-table" data-table="tasks" type="button">ייצוא משימות</button>
      </div>
      <div class="restore-box">
        <label class="field" for="restoreBackupFile">
          <span>שחזור מגיבוי JSON</span>
          <input id="restoreBackupFile" type="file" accept="application/json,.json" />
        </label>
        <button class="button danger" data-action="restore-backup" type="button">שחזור מגיבוי</button>
      </div>
      <div class="detail-list detail-grid">
        ${detail("מטופלים", state.patients.length)}
        ${detail("מפגשים", state.sessions.length)}
        ${detail("תשלומים", state.payments.length)}
        ${detail("משימות", state.tasks.length)}
        ${detail("קבצים", state.files.length)}
        ${detail("הורים ואנשי מקצוע", state.contacts.length)}
        ${detail("תאריך גיבוי", formatDate(isoDate(new Date())))}
      </div>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>בדיקת תקינות נתונים</h2></div>
      <div class="toolbar">
        <button class="button blue" data-action="check-data-health" type="button">בדיקת תקינות</button>
        <button class="button yellow" data-action="repair-data-health" type="button">תיקון מבנה</button>
      </div>
      ${dataHealthView()}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>אבטחת שיתוף</h2></div>
      <div class="toolbar">
        <button class="button blue" data-action="check-sharing-security" type="button">בדיקת הרשאות שיתוף</button>
        <button class="button yellow" data-action="repair-sharing-security" type="button">הסרת גישה ציבורית</button>
      </div>
      ${sharingSecurityView()}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>חריגי יומן</h2></div>
      <form class="inline-form schedule-exception-form" data-form="schedule-exception">
        <div class="field">
          <label for="exceptionPatientId">מטופל</label>
          <select id="exceptionPatientId" name="patient_id">
            <option value="">כל המטופלים</option>
            ${patientOptions("")}
          </select>
        </div>
        <div class="field">
          <label for="exceptionType">סוג חריג</label>
          <select id="exceptionType" name="exception_type">
            <option value="cancel">ביטול חד-פעמי</option>
            <option value="vacation">חופשה</option>
            <option value="holiday">חג</option>
            <option value="blocked">יום חסום</option>
          </select>
        </div>
        <div class="field">
          <label for="exceptionStartDate">מתאריך</label>
          <input id="exceptionStartDate" name="start_date" data-date-input placeholder="בחירת תאריך" />
        </div>
        <div class="field">
          <label for="exceptionEndDate">עד תאריך</label>
          <input id="exceptionEndDate" name="end_date" data-date-input placeholder="ריק = יום אחד" />
        </div>
        <div class="field wide">
          <label for="exceptionReason">סיבה</label>
          <input id="exceptionReason" name="reason" placeholder="חופשה / חג / ביטול" />
        </div>
        <div class="toolbar wide">
          <button class="button" type="submit">שמירת חריג</button>
        </div>
      </form>
      ${scheduleExceptionsView()}
    </section>
  `);
}

function auditLogView() {
  const rows = state.auditLog.slice(0, 20);
  if (!rows.length) return `<div class="empty">יומן הפעילות עדיין ריק.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>זמן</th><th>פעולה</th><th>משתמש</th><th>מצב</th><th>פעולה</th></tr></thead>
        <tbody>${rows.map((entry) => `
          <tr>
            <td>${html(new Date(entry.created_at).toLocaleString("he-IL"))}</td>
            <td><strong>${html(entry.summary)}</strong><small class="table-note">${html(entry.entity_type || "system")}</small></td>
            <td>${html(entry.actor_email || "-")}</td>
            <td>${entry.undone_at ? "בוטל" : entry.undoable === "yes" && auditMutations(entry).length ? "ניתן לביטול" : "תיעוד בלבד"}</td>
            <td>${entry.undoable === "yes" && !entry.undone_at && auditMutations(entry).length ? `<button class="button secondary table-button" data-action="undo-last-action" data-id="${html(entry.id)}" type="button">ביטול</button>` : "-"}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function dataHealthView() {
  if (!state.dataHealth) {
    return `<div class="empty">עדיין לא בוצעה בדיקת תקינות.</div>`;
  }

  const rows = state.dataHealth.results || [];
  return `
    <div class="health-summary ${state.dataHealth.ok ? "ok" : "warn"}">
      ${state.dataHealth.ok ? "מבנה הנתונים תקין." : "נמצאו נקודות שדורשות תיקון."}
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>גיליון</th>
            <th>מצב</th>
            <th>פירוט</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${html(row.sheet)}</td>
                  <td><span class="status-pill ${row.ok ? "done" : "open"}">${row.ok ? "תקין" : "דורש תיקון"}</span></td>
                  <td>${html(row.message)}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function sharingSecurityTargets() {
  return [
    ["תיקיית הקליניקה", state.config.googleDriveRootFolderId],
    ["גיליון נתוני הקליניקה", state.config.googleSpreadsheetId],
    ["תיקיית התבניות", state.config.googleTemplatesFolderId]
  ].filter(([, fileId]) => fileId);
}

async function drivePermissions(fileId) {
  const result = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role,emailAddress,domain,allowFileDiscovery)`
  );
  return result?.permissions || [];
}

async function runSharingSecurityAudit() {
  if (!canUseStorage()) throw new Error("צריך להתחבר לחשבון מורשה לפני בדיקת אבטחת השיתוף.");
  const results = [];
  for (const [label, fileId] of sharingSecurityTargets()) {
    const permissions = await drivePermissions(fileId);
    const publicPermissions = permissions.filter((permission) => permission.type === "anyone");
    results.push({ label, fileId, publicPermissions });
  }
  state.sharingSecurity = {
    checkedAt: new Date().toISOString(),
    ok: results.every((item) => item.publicPermissions.length === 0),
    results
  };
  return state.sharingSecurity;
}

async function repairSharingSecurity() {
  if (!canUseStorage()) throw new Error("צריך להתחבר לחשבון מורשה לפני תיקון אבטחת השיתוף.");
  let removed = 0;
  for (const [, fileId] of sharingSecurityTargets()) {
    const permissions = await drivePermissions(fileId);
    for (const permission of permissions.filter((item) => item.type === "anyone")) {
      if (!permission.id) continue;
      await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permission.id)}`,
        { method: "DELETE" }
      );
      removed += 1;
    }
  }
  const report = await runSharingSecurityAudit();
  if (!report.ok) throw new Error("נשארה הרשאת שיתוף ציבורית שלא ניתן היה להסיר אוטומטית.");
  return removed;
}

function sharingSecurityView() {
  const report = state.sharingSecurity;
  if (!report) {
    return `<div class="empty">הבדיקה רצה אוטומטית לאחר התחברות לחשבון המורשה.</div>`;
  }
  const rows = report.results
    .map(
      (item) => `<div class="security-row">
        <strong>${html(item.label)}</strong>
        <span class="status-pill ${item.publicPermissions.length ? "open" : "done"}">${
          item.publicPermissions.length ? "ציבורי" : "מוגן"
        }</span>
      </div>`
    )
    .join("");
  return `<div class="security-report">
    <div class="health-summary ${report.ok ? "ok" : "warn"}">${
      report.ok ? "אין הרשאות ציבוריות למשאבי הקליניקה." : "נמצאה גישה ציבורית למשאבי הקליניקה."
    }</div>
    ${rows}
  </div>`;
}

function scheduleExceptionsView() {
  if (!state.scheduleExceptions.length) {
    return `<div class="empty">אין חריגי יומן שמורים.</div>`;
  }

  const rows = [...state.scheduleExceptions].sort((a, b) =>
    `${b.start_date || ""} ${b.created_at || ""}`.localeCompare(`${a.start_date || ""} ${a.created_at || ""}`)
  );

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>תאריכים</th>
            <th>מטופל</th>
            <th>סוג</th>
            <th>סיבה</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (exception) => `
                <tr>
                  <td>${html(formatExceptionDateRange(exception))}</td>
                  <td>${html(exception.patient_id ? patientName(exception.patient_id) : "כל המטופלים")}</td>
                  <td>${html(exceptionTypeLabel(exception.exception_type))}</td>
                  <td>${html(exception.reason || "-")}</td>
                  <td><button class="button danger table-button" data-action="delete-schedule-exception" data-id="${html(exception.id)}" type="button">מחיקה</button></td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function detail(label, value) {
  return `<div class="detail"><span>${html(label)}</span><strong>${html(value || "-")}</strong></div>`;
}

function sessionForm(patientId) {
  const editedSession =
    state.currentSessionId &&
    state.sessions.find(
      (session) => session.id === state.currentSessionId && session.patient_id === patientId
    );
  const today = isoDate(new Date());
  return `
    <form class="form-grid inline-form" data-form="session" data-patient-id="${html(patientId)}" data-id="${html(editedSession?.id || "")}">
      <div class="field">
        <label for="session_date">תאריך מפגש</label>
        <input class="picker-input" data-date-input id="session_date" name="session_date" readonly required type="text" value="${html(editedSession?.session_date || today)}" />
      </div>
      <div class="field">
        <label for="start_time">שעת התחלה</label>
        <input class="picker-input" data-time-input id="start_time" name="start_time" readonly type="text" value="${html(editedSession?.start_time || "")}" />
      </div>
      <div class="field">
        <label for="end_time">שעת סיום</label>
        <input class="picker-input" data-time-input id="end_time" name="end_time" readonly type="text" value="${html(editedSession?.end_time || "")}" />
      </div>
      <div class="field">
        <label for="session_type">סוג מפגש</label>
        <select id="session_type" name="session_type">
          ${selectOptions(optionValues(state.config.sessionTypes, DEFAULT_SESSION_TYPES), editedSession?.session_type || "")}
        </select>
      </div>
      <div class="field wide">
        <label for="location">מיקום</label>
        <select id="location" name="location">
          ${selectOptions(optionValues(state.config.sessionLocations, DEFAULT_SESSION_LOCATIONS), editedSession?.location || "")}
        </select>
      </div>
      <div class="field wide">
        <label for="summary">תיעוד טיפול</label>
        <textarea class="treatment-textarea" id="summary" name="summary" placeholder="כתיבה חופשית של תיעוד המפגש">${html(editedSession?.summary || "")}</textarea>
      </div>
      <div class="field wide">
        <label for="sensitive_notes">הערות פנימיות</label>
        <textarea id="sensitive_notes" name="sensitive_notes" placeholder="מידע פנימי שאינו מיועד לשיתוף">${html(editedSession?.sensitive_notes || "")}</textarea>
      </div>
      ${state.goals.filter((goal) => goal.patient_id === patientId && ["planned", "active"].includes(goal.status)).map((goal) => `
        <fieldset class="field wide goal-session-update">
          <legend>${html(goal.title)}</legend>
          <div class="form-grid">
            <div class="field"><label for="goal_progress_${html(goal.id)}">התקדמות במפגש</label><input id="goal_progress_${html(goal.id)}" name="goal_progress_${html(goal.id)}" type="number" min="0" max="100" value="${html(goal.progress || "0")}" /></div>
            <div class="field"><label for="goal_note_${html(goal.id)}">הערת התקדמות</label><input id="goal_note_${html(goal.id)}" name="goal_note_${html(goal.id)}" /></div>
          </div>
        </fieldset>`).join("")}
      <div class="toolbar wide">
        <button class="button" type="submit">${editedSession ? "עדכון מפגש" : "שמירת מפגש"}</button>
        ${editedSession ? `<button class="button secondary" data-action="cancel-session-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function paymentForm(patientId) {
  const today = isoDate(new Date());
  const editedPayment =
    state.currentPaymentId &&
    state.payments.find((payment) => payment.id === state.currentPaymentId && payment.patient_id === patientId);
  const editedChargeIds = new Set(
    editedPayment
      ? state.paymentAllocations
          .filter((allocation) => allocation.payment_id === editedPayment.id)
          .map((allocation) => allocation.charge_id)
      : []
  );
  const chargeBalancesForForm = patientChargeBalances(
    patientId,
    editedPayment
      ? state.paymentAllocations.filter((allocation) => allocation.payment_id !== editedPayment.id)
      : state.paymentAllocations
  );
  const chargeOptions = chargeBalancesForForm
    .map((balance) => {
      const selectable = balance.remainingAgorot > 0;
      const details = [
        formatDate(balance.sessionDate),
        `חיוב ${formatAgorotAmount(balance.amountAgorot)}`,
        `שולם ${formatAgorotAmount(balance.paidAgorot)}`,
        `יתרה ${formatAgorotAmount(balance.remainingAgorot)}`,
        chargeStatusLabel(balance.status)
      ].join(" · ");
      return `
        <label class="charge-option">
          <input type="checkbox" name="charge_ids" value="${html(balance.chargeId)}" data-charge-remaining="${balance.remainingAgorot}" ${editedChargeIds.has(balance.chargeId) ? "checked" : ""} ${selectable ? "" : "disabled"} />
          <span>${html(details)}</span>
        </label>`;
    })
    .join("");
  const receiptFile = editedPayment?.receipt_file_id
    ? state.files.find((file) => file.drive_file_id === editedPayment.receipt_file_id)
    : null;
  return `
    <form class="form-grid inline-form" data-form="payment" data-patient-id="${html(patientId)}" data-id="${html(editedPayment?.id || "")}">
      <fieldset class="field wide" data-charge-select>
        <legend>שיוך לחיובי טיפול</legend>
        ${
          chargeOptions ||
          `<p class="empty">אין חיובי טיפול למטופל. חיוב נוצר אוטומטית בשמירת תיעוד מפגש.</p>`
        }
      </fieldset>
      <div class="field">
        <label for="amount">סכום</label>
        <input id="amount" name="amount" inputmode="decimal" required value="${html(editedPayment?.amount || "")}" />
      </div>
      <div class="field">
        <label for="paid_at">תאריך</label>
        <input class="picker-input" data-date-input id="paid_at" name="paid_at" readonly type="text" value="${html(editedPayment?.paid_at || today)}" />
      </div>
      <div class="field">
        <label for="payment_method">אמצעי תשלום</label>
        <select id="payment_method" name="payment_method">
          <option value="bank_transfer" ${editedPayment?.payment_method === "bank_transfer" ? "selected" : ""}>העברה בנקאית</option>
          <option value="cash" ${editedPayment?.payment_method === "cash" ? "selected" : ""}>מזומן</option>
          <option value="bit" ${editedPayment?.payment_method === "bit" ? "selected" : ""}>ביט</option>
          <option value="credit" ${editedPayment?.payment_method === "credit" ? "selected" : ""}>אשראי</option>
        </select>
      </div>
      <div class="field">
        <label for="payment_status">סטטוס</label>
        <select id="payment_status" name="payment_status">
          <option value="paid" ${editedPayment?.payment_status === "paid" ? "selected" : ""}>שולם</option>
          <option value="unpaid" ${editedPayment?.payment_status === "unpaid" ? "selected" : ""}>פתוח</option>
          <option value="partial" ${editedPayment?.payment_status === "partial" ? "selected" : ""}>חלקי</option>
        </select>
      </div>
      <div class="field">
        <label for="receipt_status">קבלה</label>
        <select id="receipt_status" name="receipt_status">
          <option value="needed" ${editedPayment?.receipt_status === "needed" ? "selected" : ""}>דרושה קבלה</option>
          <option value="issued" ${editedPayment?.receipt_status === "issued" ? "selected" : ""}>הופקה קבלה</option>
          <option value="not_needed" ${editedPayment?.receipt_status === "not_needed" ? "selected" : ""}>לא נדרש</option>
        </select>
      </div>
      <div class="field wide">
        <label for="payment_notes">הערות</label>
        <textarea id="payment_notes" name="notes">${html(editedPayment?.notes || "")}</textarea>
      </div>
      <div class="field wide">
        <label for="receipt_upload">${receiptFile ? "החלפת קובץ קבלה" : "קובץ קבלה"}</label>
        <input id="receipt_upload" name="receipt_upload" type="file" />
        ${
          receiptFile
            ? `<small><a href="${html(receiptFile.url || driveFileUrl(receiptFile.drive_file_id))}" target="_blank" rel="noopener">קבלה קיימת: ${html(receiptFile.name || "פתיחה")}</a></small>`
            : ""
        }
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">${editedPayment ? "עדכון תשלום" : "שמירת תשלום"}</button>
        ${editedPayment ? `<button class="button secondary" data-action="cancel-payment-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function sessionsPanel(items = state.sessions, patientId = "") {
  const rows = items.slice(0, 5);
  const patientMode = Boolean(patientId);
  return `
    <article class="panel ${patientMode ? "profile-wide" : ""}">
      <div class="panel-head"><h2>${patientMode ? "תיעוד מפגש" : "מפגשים קרובים"}</h2>${patientMode ? "" : "<span>היום והשבוע הקרוב</span>"}</div>
      ${patientMode ? recordingPanel(state.patients.find((patient) => patient.id === patientId) || { id: patientId }) : ""}
      ${patientId ? sessionForm(patientId) : ""}
      ${
        rows.length
          ? `<div class="item-list">${rows
              .map(
                (session) => `
                  <article class="list-item">
                    <div><strong>${html(formatDate(session.session_date))}</strong><span>${html([session.start_time, session.end_time].filter(Boolean).join("-") || "ללא שעה")}</span></div>
                    <div><strong>${html(session.session_type || "מפגש")}</strong><span>${html(patientName(session.patient_id))}</span></div>
                    <p>${html(session.summary || "לא נכתב סיכום.")}</p>
                    ${
                      patientMode
                        ? `<div class="actions">
                            <button class="button secondary table-button" data-action="edit-session" data-id="${html(session.id)}" type="button">עריכה</button>
                            <button class="button danger table-button" data-action="delete-session" data-id="${html(session.id)}" type="button">מחיקה</button>
                          </div>`
                        : ""
                    }
                  </article>`
              )
              .join("")}</div>`
          : patientMode
            ? ""
            : `<div class="empty">עדיין אין מפגשים להצגה.</div>`
      }
    </article>`;
}

function patientChargesSection(patientId) {
  const balances = patientChargeBalances(patientId);
  const outstandingAgorot = PaymentsCore.outstandingTotal(balances);
  return `
    <div class="metric-row">
      <article class="metric pink-card"><strong>${html(formatAgorotAmount(outstandingAgorot))}</strong><span>יתרת חוב פתוחה</span></article>
    </div>
    <div class="panel-head"><h2>חיובי טיפול</h2><span>${balances.length} חיובים</span></div>
    ${
      balances.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>תאריך מפגש</th>
                  <th>סכום חיוב</th>
                  <th>שולם</th>
                  <th>יתרה</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                ${balances
                  .map(
                    (balance) => `
                    <tr>
                      <td>${html(formatDate(balance.sessionDate))}</td>
                      <td>${
                        state.currentChargeId === balance.chargeId
                          ? `<input type="text" inputmode="decimal" class="charge-amount-input" data-charge-amount-input value="${html(PaymentsCore.agorotToAmountText(balance.amountAgorot))}" aria-label="סכום חיוב חדש">`
                          : html(formatAgorotAmount(balance.amountAgorot))
                      }</td>
                      <td>${html(formatAgorotAmount(balance.paidAgorot))}</td>
                      <td>${html(formatAgorotAmount(balance.remainingAgorot))}</td>
                      <td><span class="status-pill">${html(chargeStatusLabel(balance.status))}</span></td>
                      <td>
                        <div class="row-actions">
                          ${
                            state.currentChargeId === balance.chargeId
                              ? `<button class="button table-button" data-action="save-charge-amount" data-id="${html(balance.chargeId)}" type="button">שמירת סכום</button>
                                 <button class="button secondary table-button" data-action="cancel-charge-edit" type="button">חזרה</button>`
                              : `<button class="button secondary table-button" data-action="edit-charge" data-id="${html(balance.chargeId)}" type="button">עריכת חיוב</button>
                                 <button class="button danger table-button" data-action="cancel-charge" data-id="${html(balance.chargeId)}" type="button">ביטול חיוב</button>`
                          }
                        </div>
                      </td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : `<div class="empty">עדיין אין חיובי טיפול. חיוב נוצר אוטומטית בשמירת תיעוד מפגש.</div>`
    }`;
}

function paymentsPanel(items = state.payments, patientId = "") {
  const rows = items.slice(0, 5);
  return `
    <article class="panel">
      <div class="panel-head"><h2>תשלומים</h2></div>
      ${patientId ? patientChargesSection(patientId) : ""}
      ${patientId ? paymentForm(patientId) : ""}
      ${
        rows.length
          ? `<div class="item-list">${rows
              .map(
                (payment) => `
                  <article class="list-item">
                    <div><strong>${html(formatAmount(payment.amount))}</strong><span>${html(formatDate(payment.paid_at))}</span></div>
                    <div><strong>${html(paymentMethodLabel(payment.payment_method))}</strong><span>${html(patientName(payment.patient_id))}</span></div>
                    ${payment.session_id ? `<p>${html(sessionLabelById(payment.session_id))}</p>` : ""}
                    <p>${html(payment.notes || paymentStatusLabel(payment.payment_status))}</p>
                    <div class="actions">
                      <button class="button secondary table-button" data-action="edit-payment" data-id="${html(payment.id)}" type="button">עריכה</button>
                      ${
                        payment.payment_status === "paid"
                          ? `<button class="button secondary table-button" data-action="set-payment-status" data-id="${html(payment.id)}" data-status="unpaid" type="button">פתח</button>`
                          : `<button class="button table-button" data-action="set-payment-status" data-id="${html(payment.id)}" data-status="paid" type="button">שולם</button>`
                      }
                      ${
                        payment.receipt_file_id
                          ? `<button class="button secondary table-button" data-action="delete-payment-receipt" data-id="${html(payment.id)}" type="button">מחיקת קבלה</button>`
                          : ""
                      }
                      ${
                        payment.payment_status === "paid" && payment.receipt_status !== "issued"
                          ? `<button class="button blue table-button" data-action="set-receipt-status" data-id="${html(payment.id)}" data-status="issued" type="button">קבלה הופקה</button>`
                          : ""
                      }
                      <button class="button danger table-button" data-action="delete-payment" data-id="${html(payment.id)}" type="button">מחיקה</button>
                    </div>
                  </article>`
              )
              .join("")}</div>`
          : `<div class="empty">עדיין אין תשלומים להצגה.</div>`
      }
    </article>`;
}

function calendarPage() {
  const today = isoDate(new Date());
  const days = calendarDays(state.calendarMonth);
  const rows = sessionsForDates(days.map((day) => day.date));
  const selectedSessions = rows.filter((session) => session.session_date === state.selectedCalendarDate);
  const selectedExceptions = scheduleExceptionsForDate(state.selectedCalendarDate);
  const selectedHolidays = israelHolidaysForDate(state.selectedCalendarDate);
  const sessionsByDate = rows.reduce((acc, session) => {
    if (!session.session_date) return acc;
    acc[session.session_date] = [...(acc[session.session_date] || []), session];
    return acc;
  }, {});
  const weekDays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return shell(`
    ${header(
      "יומן",
      "",
      `<button class="button secondary" data-action="calendar-prev" type="button">חודש קודם</button>
       <button class="button blue" data-action="calendar-today" type="button">היום</button>
       <button class="button secondary" data-action="calendar-next" type="button">חודש הבא</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>`
    )}
    ${connectionBanner()}
    <section class="calendar-layout">
      <article class="panel calendar-panel">
        <div class="panel-head">
          <h2>${html(monthLabel(state.calendarMonth))}</h2>
          <span>${rows.length} מפגשים במערכת</span>
        </div>
        <div class="calendar-weekdays">
          ${weekDays.map((day) => `<span>${day}</span>`).join("")}
        </div>
        <div class="calendar-grid">
          ${days
            .map((day) => {
              const daySessions = sessionsByDate[day.date] || [];
              const dayHolidays = israelHolidaysForDate(day.date);
              const holidayLabel = dayHolidays.map((holiday) => holiday.title).join(", ");
              return `
                <button class="calendar-day ${day.inMonth ? "" : "muted"} ${day.date === today ? "today" : ""} ${day.date === state.selectedCalendarDate ? "selected" : ""} ${daySessions.length ? "has-events" : ""} ${dayHolidays.length ? "has-holiday" : ""}" data-action="select-calendar-date" data-date="${html(day.date)}" type="button" aria-label="${html(`${formatDate(day.date)}: ${daySessions.length} מפגשים${holidayLabel ? `; ${holidayLabel}` : ""}`)}">
                  <span class="day-number">${Number(day.date.slice(8, 10))}</span>
                  ${daySessions.length ? `<span class="calendar-mobile-count" aria-hidden="true">${daySessions.length}</span>` : ""}
                  <span class="day-events">
                    ${dayHolidays
                      .slice(0, 1)
                      .map((holiday) => `<span class="calendar-holiday">${html(holiday.title)}</span>`)
                      .join("")}
                    ${daySessions
                      .slice(0, 1)
                      .map(
                        (session) =>
                          `<span class="calendar-event">${html(session.start_time || "")} ${html(patientName(session.patient_id))}</span>`
                      )
                      .join("")}
                    ${
                      daySessions.length > 1
                        ? `<span class="calendar-more">+${daySessions.length - 1}</span>`
                        : ""
                    }
                  </span>
                </button>`;
            })
            .join("")}
        </div>
      </article>
      <aside class="panel day-panel">
        <div class="panel-head">
          <h2>${html(formatDate(state.selectedCalendarDate))}</h2>
          <span>${selectedSessions.length} מפגשים${selectedHolidays.length ? `, ${selectedHolidays.length} מועדים` : ""}${selectedExceptions.length ? `, ${selectedExceptions.length} חריגים` : ""}</span>
        </div>
        ${
          selectedHolidays.length
            ? `<div class="holiday-list">${selectedHolidays
                .map(
                  (holiday) => `
                    <a class="holiday-note" href="${html(holiday.link)}" target="_blank" rel="noopener">
                      <strong>${html(holiday.title)}</strong>
                      ${holiday.memo ? `<span>${html(holiday.memo)}</span>` : ""}
                    </a>`
                )
                .join("")}</div>`
            : ""
        }
        ${
          selectedExceptions.length
            ? `<div class="exception-list">${selectedExceptions
                .map(
                  (exception) => `
                    <div class="exception-note">
                      <strong>${html(exceptionTypeLabel(exception.exception_type))}</strong>
                      <span>${html(exception.patient_id ? patientName(exception.patient_id) : "כל המטופלים")} ${exception.reason ? `- ${exception.reason}` : ""}</span>
                    </div>`
                )
                .join("")}</div>`
            : ""
        }
        ${
          selectedSessions.length
            ? `<div class="day-agenda">${selectedSessions
                .map(
                  (session) => `
                  <div class="day-agenda-row">
                    <time>${html(session.start_time || "--:--")}</time>
                    <strong>${html(patientName(session.patient_id))}</strong>
                  </div>`
                )
                .join("")}</div>`
            : `<div class="empty">אין מפגשים ביום הזה.</div>`
        }
        <div class="hebcal-credit">מועדי ישראל באדיבות <a href="https://www.hebcal.com/" target="_blank" rel="noopener">Hebcal</a>${state.israelHolidayError ? ` · ${html(state.israelHolidayError)}` : ""}</div>
      </aside>
    </section>
  `);
}

function paymentsPage() {
  const rows = [...state.payments].sort((a, b) =>
    `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
  );
  const receiptsToPrepare = rows.filter(
    (payment) => payment.payment_status === "paid" && payment.receipt_status !== "issued"
  );
  const paidTotal = rows
    .filter((payment) => payment.payment_status === "paid")
    .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const chargeBalanceRows = allChargeBalances();
  const openChargeRows = chargeBalanceRows.filter((balance) => balance.remainingAgorot > 0);
  const openAgorot = PaymentsCore.outstandingTotal(chargeBalanceRows);

  return shell(`
    ${header(
      "תשלומים",
      "",
      `<button class="button secondary" data-action="refresh" type="button">רענון</button>
       <button class="button blue" data-action="export-receipts" type="button">ייצוא קבלות להכנה</button>
       <a class="button yellow" href="#/patients">פתיחת מטופלים</a>`
    )}
    ${connectionBanner()}
    <section class="metric-row">
      <article class="metric blue-card"><strong>${html(formatAmount(paidTotal))}</strong><span>שולם</span></article>
      <article class="metric pink-card"><strong>${html(formatAgorotAmount(openAgorot))}</strong><span>פתוח</span></article>
      <article class="metric teal-card"><strong>${receiptsToPrepare.length}</strong><span>קבלות להכנה</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>חיובים פתוחים</h2><span>${openChargeRows.length} חיובים</span></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>מטופל</th>
              <th>תאריך מפגש</th>
              <th>סכום חיוב</th>
              <th>שולם</th>
              <th>יתרה</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${openChargeRows
              .map(
                (balance) => `
                <tr>
                  <td><strong>${html(patientName(balance.patientId))}</strong></td>
                  <td>${html(formatDate(balance.sessionDate))}</td>
                  <td>${html(formatAgorotAmount(balance.amountAgorot))}</td>
                  <td>${html(formatAgorotAmount(balance.paidAgorot))}</td>
                  <td>${html(formatAgorotAmount(balance.remainingAgorot))}</td>
                  <td><span class="status-pill">${html(chargeStatusLabel(balance.status))}</span></td>
                  <td><button class="button secondary table-button" data-action="open-profile" data-id="${html(balance.patientId)}" type="button">כרטיס</button></td>
                </tr>`
              )
              .join("") || `<tr><td colspan="7"><div class="empty">אין חיובים פתוחים. חיוב נוצר אוטומטית בשמירת תיעוד מפגש.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel page-gap">
      <div class="panel-head count-only"><span>${rows.length} תשלומים</span></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>תאריך</th>
              <th>מטופל</th>
              <th>מפגש</th>
              <th>סכום</th>
              <th>אמצעי</th>
              <th>תשלום</th>
              <th>קבלה</th>
              <th>הערות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (payment) => `
                <tr>
                  <td>${html(formatDate(payment.paid_at))}</td>
                  <td><strong>${html(patientName(payment.patient_id))}</strong></td>
                  <td>${html(payment.session_id ? sessionLabelById(payment.session_id) : "-")}</td>
                  <td>${html(formatAmount(payment.amount))}</td>
                  <td>${html(paymentMethodLabel(payment.payment_method))}</td>
                  <td><span class="status-pill">${html(paymentStatusLabel(payment.payment_status))}</span></td>
                  <td>${
                    payment.receipt_file_id
                      ? `<a href="${html(driveFileUrl(payment.receipt_file_id))}" target="_blank" rel="noopener">${html(receiptStatusLabel(payment.receipt_status))}</a>`
                      : html(receiptStatusLabel(payment.receipt_status))
                  }</td>
                  <td>${html(payment.notes || "-")}</td>
                  <td>
                    <div class="actions">
                      <button class="button secondary table-button" data-action="open-profile" data-id="${html(payment.patient_id)}" type="button">כרטיס</button>
                      <button class="button secondary table-button" data-action="edit-payment" data-id="${html(payment.id)}" type="button">עריכה</button>
                      ${
                        payment.payment_status === "paid"
                          ? `<button class="button secondary table-button" data-action="set-payment-status" data-id="${html(payment.id)}" data-status="unpaid" type="button">פתח</button>`
                          : `<button class="button table-button" data-action="set-payment-status" data-id="${html(payment.id)}" data-status="paid" type="button">שולם</button>`
                      }
                      ${
                        payment.receipt_file_id
                          ? `<button class="button secondary table-button" data-action="delete-payment-receipt" data-id="${html(payment.id)}" type="button">מחיקת קבלה</button>`
                          : ""
                      }
                      ${
                        payment.payment_status === "paid" && payment.receipt_status !== "issued"
                          ? `<button class="button blue table-button" data-action="set-receipt-status" data-id="${html(payment.id)}" data-status="issued" type="button">קבלה הופקה</button>`
                          : ""
                      }
                      <button class="button danger table-button" data-action="delete-payment" data-id="${html(payment.id)}" type="button">מחיקה</button>
                    </div>
                  </td>
                </tr>`
              )
              .join("") || `<tr><td colspan="9"><div class="empty">אין תשלומים להצגה. אפשר להוסיף תשלום מתוך כרטיס מטופל.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `);
}

function reportsPage() {
  const month = state.reportMonth;
  const monthSessions = state.sessions.filter((session) => session.session_date?.startsWith(month));
  const monthPayments = state.payments.filter((payment) => payment.paid_at?.startsWith(month));
  const monthTasks = state.tasks.filter(
    (task) => task.due_date?.startsWith(month) || task.created_at?.startsWith(month)
  );
  const monthFiles = state.files.filter((file) => file.created_at?.startsWith(month));
  const paidTotal = monthPayments
    .filter((payment) => payment.payment_status === "paid")
    .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const openPayments = state.payments.filter((payment) => payment.payment_status !== "paid");
  const openTotal = openPayments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const missingReceipts = state.payments.filter(
    (payment) => payment.payment_status === "paid" && payment.receipt_status !== "issued"
  );
  const openTasks = monthTasks.filter((task) => task.status !== "done");

  const patientRows = state.patients
    .map((patient) => {
      const sessions = monthSessions.filter((session) => session.patient_id === patient.id);
      const payments = monthPayments.filter((payment) => payment.patient_id === patient.id);
      const paid = payments
        .filter((payment) => payment.payment_status === "paid")
        .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
      const open = state.payments
        .filter((payment) => payment.patient_id === patient.id && payment.payment_status !== "paid")
        .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
      const receipts = payments.filter(
        (payment) => payment.payment_status === "paid" && payment.receipt_status !== "issued"
      ).length;

      return {
        id: patient.id,
        name: patient.child_name,
        open,
        paid,
        receipts,
        sessions: sessions.length
      };
    })
    .filter((row) => row.sessions || row.paid || row.open || row.receipts)
    .sort((a, b) => b.paid - a.paid || b.sessions - a.sessions);

  return shell(`
    ${header(
      `דוחות · ${monthLabel(month)}`,
      "",
      `<button class="button secondary" data-action="reports-prev" type="button">חודש קודם</button>
       <button class="button blue" data-action="reports-current" type="button">החודש</button>
       <button class="button secondary" data-action="reports-next" type="button">חודש הבא</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>`
    )}
    ${connectionBanner()}
    <section class="metric-row reports-metrics">
      <article class="metric blue-card"><strong>${html(formatAmount(paidTotal))}</strong><span>הכנסות בחודש</span></article>
      <article class="metric pink-card"><strong>${html(formatAmount(openTotal))}</strong><span>תשלומים פתוחים</span></article>
      <article class="metric teal-card"><strong>${monthSessions.length}</strong><span>מפגשים בחודש</span></article>
      <article class="metric purple-card"><strong>${openTasks.length}</strong><span>משימות פתוחות</span></article>
    </section>
    <section class="grid-two reports-grid">
      <article class="panel">
        <div class="panel-head"><h2>מפגשים לפי מטופל</h2><span>${patientRows.length} מטופלים</span></div>
        <div class="table-wrap">
          <table class="report-table">
            <thead>
              <tr>
                <th>מטופל</th>
                <th>מפגשים</th>
                <th>שולם</th>
                <th>פתוח</th>
                <th>קבלות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${patientRows
                .map(
                  (row) => `
                  <tr>
                    <td><strong>${html(row.name || "-")}</strong></td>
                    <td>${row.sessions}</td>
                    <td>${html(formatAmount(row.paid))}</td>
                    <td>${html(formatAmount(row.open))}</td>
                    <td>${row.receipts ? `${row.receipts} חסרות` : "תקין"}</td>
                    <td><button class="button secondary table-button" data-action="open-profile" data-id="${html(row.id)}" type="button">כרטיס</button></td>
                  </tr>`
                )
                .join("") || `<tr><td colspan="6"><div class="empty">אין נתונים לחודש הזה.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>תשלומים פתוחים</h2><span>${openPayments.length} רשומות</span></div>
        <div class="report-list">
          ${openPayments
            .slice(0, 10)
            .map(
              (payment) => `
              <article class="report-item">
                <strong>${html(patientName(payment.patient_id))}</strong>
                <span>${html(formatAmount(payment.amount))} | ${html(paymentStatusLabel(payment.payment_status))}</span>
                <button class="button secondary table-button" data-action="open-profile" data-id="${html(payment.patient_id)}" type="button">כרטיס</button>
              </article>`
            )
            .join("") || `<div class="empty">אין תשלומים פתוחים.</div>`}
        </div>
      </article>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>קבלות חסרות</h2><span>${missingReceipts.length} רשומות</span></div>
      <div class="table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>מטופל</th>
              <th>סכום</th>
              <th>אמצעי</th>
              <th>סטטוס קבלה</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${missingReceipts
              .map(
                (payment) => `
                <tr>
                  <td>${html(formatDate(payment.paid_at))}</td>
                  <td><strong>${html(patientName(payment.patient_id))}</strong></td>
                  <td>${html(formatAmount(payment.amount))}</td>
                  <td>${html(paymentMethodLabel(payment.payment_method))}</td>
                  <td>${html(receiptStatusLabel(payment.receipt_status))}</td>
                  <td><button class="button secondary table-button" data-action="open-profile" data-id="${html(payment.patient_id)}" type="button">כרטיס</button></td>
                </tr>`
              )
              .join("") || `<tr><td colspan="6"><div class="empty">אין קבלות חסרות.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    <section class="grid-two reports-grid page-gap">
      <article class="panel">
        <div class="panel-head"><h2>משימות לחודש</h2><span>${openTasks.length} פתוחות</span></div>
        ${tasksTable(openTasks.slice(0, 8))}
      </article>
      <article class="panel">
        <div class="panel-head"><h2>קבצים שנוספו</h2><span>${monthFiles.length} בחודש</span></div>
        ${filesTable(monthFiles.slice(0, 8))}
      </article>
    </section>
  `);
}

function patientOptions(selectedId = "") {
  return state.patients
    .map(
      (patient) =>
        `<option value="${html(patient.id)}" ${patient.id === selectedId ? "selected" : ""}>${html(patient.child_name)}</option>`
    )
    .join("");
}

function contactTypeLabel(value) {
  return value === "professional" ? "איש/אשת מקצוע" : "הורה או בן משפחה";
}

function contactForm(patientId) {
  const edited = state.currentContactId
    ? state.contacts.find(
        (contact) => contact.id === state.currentContactId && contact.patient_id === patientId
      )
    : null;
  return `
    <form class="form-grid inline-form" data-form="contact" data-patient-id="${html(patientId)}" data-id="${html(edited?.id || "")}">
      <div class="field">
        <label for="contact_type">סוג קשר</label>
        <select id="contact_type" name="contact_type">
          <option value="parent" ${edited?.contact_type === "professional" ? "" : "selected"}>הורה או בן משפחה</option>
          <option value="professional" ${edited?.contact_type === "professional" ? "selected" : ""}>איש/אשת מקצוע</option>
        </select>
      </div>
      <div class="field">
        <label for="contact_name">שם</label>
        <input id="contact_name" name="name" required value="${html(edited?.name || "")}" />
      </div>
      <div class="field">
        <label for="contact_relationship">קרבה או תפקיד</label>
        <input id="contact_relationship" name="relationship" placeholder="למשל: אמא, קלינאית תקשורת" value="${html(edited?.relationship || "")}" />
      </div>
      <div class="field">
        <label for="contact_organization">מסגרת או ארגון</label>
        <input id="contact_organization" name="organization" value="${html(edited?.organization || "")}" />
      </div>
      <div class="field">
        <label for="contact_phone">טלפון</label>
        <input id="contact_phone" name="phone" inputmode="tel" value="${html(edited?.phone || "")}" />
      </div>
      <div class="field">
        <label for="contact_email">אימייל</label>
        <input id="contact_email" name="email" type="email" value="${html(edited?.email || "")}" />
      </div>
      <div class="field wide">
        <label for="contact_notes">הערות</label>
        <textarea id="contact_notes" name="notes">${html(edited?.notes || "")}</textarea>
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">${edited ? "שמירת שינויים" : "הוספת איש קשר"}</button>
        ${edited ? `<button class="button secondary" data-action="cancel-contact-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function contactsTable(rows) {
  return `
    <div class="contact-cards">
      ${rows
        .map(
          (contact) => `
            <article class="contact-card">
              <div class="contact-card-head">
                <div>
                  <span class="status-pill">${html(contactTypeLabel(contact.contact_type))}</span>
                  <h3>${html(contact.name)}</h3>
                  <p>${html([contact.relationship, contact.organization].filter(Boolean).join(" · ") || "ללא תפקיד או מסגרת")}</p>
                </div>
                <div class="actions">
                  <button class="button secondary table-button" data-action="edit-contact" data-id="${html(contact.id)}" type="button">עריכה</button>
                  <button class="button danger table-button" data-action="delete-contact" data-id="${html(contact.id)}" type="button">מחיקה</button>
                </div>
              </div>
              <div class="contact-links">
                ${contact.phone ? `<a href="tel:${html(contact.phone)}">${html(contact.phone)}</a>` : `<span>אין טלפון</span>`}
                ${contact.email ? `<a href="mailto:${html(contact.email)}">${html(contact.email)}</a>` : `<span>אין אימייל</span>`}
              </div>
              ${contact.notes ? `<p class="contact-notes">${html(contact.notes)}</p>` : ""}
            </article>`
        )
        .join("") || `<div class="empty">עדיין לא נוספו הורים או אנשי מקצוע.</div>`}
    </div>`;
}

function contactsPanel(rows, patientId) {
  const ordered = [...rows].sort((a, b) =>
    `${a.contact_type || "parent"} ${a.name || ""}`.localeCompare(
      `${b.contact_type || "parent"} ${b.name || ""}`,
      "he"
    )
  );
  return `
    <article class="panel">
      <div class="panel-head"><h2>הורים ואנשי מקצוע</h2><span>${ordered.length} אנשי קשר</span></div>
      ${contactForm(patientId)}
      ${contactsTable(ordered)}
    </article>`;
}

function taskStatusLabel(value) {
  return {
    open: "פתוחה",
    waiting: "בהמתנה",
    done: "בוצעה"
  }[value] || "פתוחה";
}

function taskForm(patientId = "") {
  const editedTask =
    state.currentTaskId &&
    state.tasks.find((task) => task.id === state.currentTaskId && (!patientId || task.patient_id === patientId));
  return `
    <form class="form-grid inline-form" data-form="task" data-patient-id="${html(patientId)}" data-id="${html(editedTask?.id || "")}">
      ${
        patientId
          ? ""
          : `<div class="field">
              <label for="task_patient_id">מטופל</label>
              <select id="task_patient_id" name="patient_id" required>
                <option value="">בחירה</option>
                ${patientOptions(editedTask?.patient_id || "")}
              </select>
            </div>`
      }
      <div class="field">
        <label for="task_title">משימה</label>
        <input id="task_title" name="title" required placeholder="למשל: לשלוח סיכום להורה" value="${html(editedTask?.title || "")}" />
      </div>
      <div class="field">
        <label for="task_due_date">תאריך יעד</label>
        <input class="picker-input" data-date-input id="task_due_date" name="due_date" readonly type="text" value="${html(editedTask?.due_date || "")}" />
      </div>
      <div class="field">
        <label for="task_reminder_at">תזכורת בתאריך</label>
        <input class="picker-input" data-date-input id="task_reminder_at" name="reminder_at" readonly type="text" value="${html(editedTask?.reminder_at || editedTask?.due_date || "")}" />
      </div>
      <div class="field">
        <label for="task_status">סטטוס</label>
        <select id="task_status" name="status">
          <option value="open" ${editedTask?.status === "open" ? "selected" : ""}>פתוחה</option>
          <option value="waiting" ${editedTask?.status === "waiting" ? "selected" : ""}>בהמתנה</option>
          <option value="done" ${editedTask?.status === "done" ? "selected" : ""}>בוצעה</option>
        </select>
      </div>
      <div class="field wide">
        <label for="task_description">פירוט</label>
        <textarea id="task_description" name="description">${html(editedTask?.description || "")}</textarea>
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">${editedTask ? "עדכון משימה" : "שמירת משימה"}</button>
        ${editedTask ? `<button class="button secondary" data-action="cancel-task-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function tasksTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>יעד / תזכורת</th>
            <th>מטופל</th>
            <th>משימה</th>
            <th>סטטוס</th>
            <th>פירוט</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (task) => `
              <tr>
                <td>${html(formatDate(task.due_date))}<small class="table-note">${task.reminder_at ? `תזכורת: ${html(formatDate(task.reminder_at))}` : ""}</small></td>
                <td><strong>${html(patientName(task.patient_id))}</strong></td>
                <td>${html(task.title || "-")}</td>
                <td><span class="status-pill">${html(taskStatusLabel(task.status))}</span></td>
                <td>${html(task.description || "-")}</td>
                <td>
                  <div class="actions">
                    <button class="button secondary table-button" data-action="open-profile" data-id="${html(task.patient_id)}" type="button">כרטיס</button>
                    <button class="button secondary table-button" data-action="edit-task" data-id="${html(task.id)}" type="button">עריכה</button>
                    ${
                      task.status === "done"
                        ? ""
                        : `<button class="button table-button" data-action="complete-task" data-id="${html(task.id)}" type="button">בוצע</button>`
                    }
                    <button class="button danger table-button" data-action="delete-task" data-id="${html(task.id)}" type="button">מחיקה</button>
                  </div>
                </td>
              </tr>`
            )
            .join("") || `<tr><td colspan="6"><div class="empty">אין משימות להצגה.</div></td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function tasksPanel(items = state.tasks, patientId = "") {
  const rows = items.slice(0, 6);
  return `
    <article class="panel">
      <div class="panel-head"><h2>משימות</h2><span>${rows.length} לתצוגה</span></div>
      ${patientId ? taskForm(patientId) : ""}
      ${tasksTable(rows)}
    </article>`;
}

function activeReminders() {
  const today = isoDate(new Date());
  return state.tasks
    .filter((task) => ["today", "overdue"].includes(WorkflowCore.reminderState(task, today)))
    .sort((a, b) => `${a.reminder_at || a.due_date || ""}`.localeCompare(`${b.reminder_at || b.due_date || ""}`));
}

function remindersPanel() {
  const reminders = activeReminders();
  if (!reminders.length) return "";
  return `
    <article class="panel reminder-panel">
      <div class="panel-head"><h2>תזכורות פעילות</h2><span>${reminders.length} דורשות תשומת לב</span></div>
      <div class="reminder-list">
        ${reminders.slice(0, 8).map((task) => `
          <div class="reminder-row ${WorkflowCore.reminderState(task, isoDate(new Date()))}">
            <div><strong>${html(task.title)}</strong><span>${html(patientName(task.patient_id))} · ${html(formatDate(task.reminder_at || task.due_date))}</span></div>
            <button class="button table-button" data-action="complete-task" data-id="${html(task.id)}" type="button">בוצע</button>
          </div>`).join("")}
      </div>
    </article>`;
}

function taskDueMatches(task, dueFilter) {
  if (!dueFilter) return true;
  const today = isoDate(new Date());
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

function filteredTasks(rows) {
  return rows.filter((task) => {
    const statusOk = !state.taskFilter.status || task.status === state.taskFilter.status;
    const patientOk = !state.taskFilter.patient || task.patient_id === state.taskFilter.patient;
    return statusOk && patientOk && taskDueMatches(task, state.taskFilter.due);
  });
}

function taskFiltersPanel(total, shown) {
  return `
    <section class="panel compact-panel">
      <div class="panel-head"><h2>סינון משימות</h2><span>${shown} מתוך ${total}</span></div>
      <div class="form-grid compact-form">
        <div class="field">
          <label for="task_filter_status">סטטוס</label>
          <select id="task_filter_status" data-task-filter="status">
            <option value="" ${state.taskFilter.status ? "" : "selected"}>כל הסטטוסים</option>
            <option value="open" ${state.taskFilter.status === "open" ? "selected" : ""}>פתוחות</option>
            <option value="waiting" ${state.taskFilter.status === "waiting" ? "selected" : ""}>בהמתנה</option>
            <option value="done" ${state.taskFilter.status === "done" ? "selected" : ""}>בוצעו</option>
          </select>
        </div>
        <div class="field">
          <label for="task_filter_patient">מטופל</label>
          <select id="task_filter_patient" data-task-filter="patient">
            <option value="" ${state.taskFilter.patient ? "" : "selected"}>כל המטופלים</option>
            ${patientOptions(state.taskFilter.patient)}
          </select>
        </div>
        <div class="field">
          <label for="task_filter_due">תאריך יעד</label>
          <select id="task_filter_due" data-task-filter="due">
            <option value="" ${state.taskFilter.due ? "" : "selected"}>כל התאריכים</option>
            <option value="overdue" ${state.taskFilter.due === "overdue" ? "selected" : ""}>באיחור</option>
            <option value="today" ${state.taskFilter.due === "today" ? "selected" : ""}>היום</option>
            <option value="week" ${state.taskFilter.due === "week" ? "selected" : ""}>השבוע הקרוב</option>
            <option value="no_date" ${state.taskFilter.due === "no_date" ? "selected" : ""}>ללא תאריך</option>
          </select>
        </div>
      </div>
    </section>`;
}

function tasksPage() {
  const rows = [...state.tasks].sort((a, b) =>
    `${a.status === "done" ? "1" : "0"} ${a.due_date || "9999-99-99"}`.localeCompare(
      `${b.status === "done" ? "1" : "0"} ${b.due_date || "9999-99-99"}`
    )
  );
  const shownRows = filteredTasks(rows);
  const openCount = rows.filter((task) => task.status !== "done").length;
  const dueToday = isoDate(new Date());
  const dueCount = rows.filter((task) => task.status !== "done" && task.due_date && task.due_date <= dueToday).length;

  return shell(`
    ${header(
      "משימות",
      "",
      `<button class="button secondary" data-action="refresh" type="button">רענון</button>
       <a class="button yellow" href="#/patients">פתיחת מטופלים</a>`
    )}
    ${connectionBanner()}
    <section class="metric-row">
      <article class="metric blue-card"><strong>${openCount}</strong><span>משימות פתוחות</span></article>
      <article class="metric pink-card"><strong>${dueCount}</strong><span>דורשות טיפול</span></article>
      <article class="metric teal-card"><strong>${rows.length}</strong><span>סה"כ משימות</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>משימה חדשה</h2></div>
      ${taskForm()}
    </section>
    ${taskFiltersPanel(rows.length, shownRows.length)}
    <section class="panel page-gap">
      <div class="panel-head count-only"><span>${shownRows.length} משימות</span></div>
      ${tasksTable(shownRows)}
    </section>
  `);
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

function fileForm(patientId = "") {
  const editedFile =
    state.currentFileId &&
    state.files.find((file) => file.id === state.currentFileId && (!patientId || file.patient_id === patientId));
  const selectedPatientId = editedFile?.patient_id || patientId;
  return `
    <form class="form-grid inline-form" data-form="file" data-patient-id="${html(patientId)}" data-id="${html(editedFile?.id || "")}">
      ${
        patientId
          ? ""
          : `<div class="field">
              <label for="file_patient_id">מטופל</label>
              <select id="file_patient_id" name="patient_id" required>
                <option value="">בחירה</option>
                ${patientOptions(selectedPatientId)}
              </select>
            </div>`
      }
      <div class="field">
        <label for="file_name">שם קובץ</label>
        <input id="file_name" name="name" placeholder="אם ריק, יישמר בשם הקובץ המקורי" value="${html(editedFile?.name || "")}" />
      </div>
      <div class="field">
        <label for="file_type">סוג</label>
        <select id="file_type" name="file_type">
          <option value="document" ${editedFile?.file_type === "document" ? "selected" : ""}>מסמך</option>
          <option value="summary" ${editedFile?.file_type === "summary" ? "selected" : ""}>סיכום</option>
          <option value="receipt" ${editedFile?.file_type === "receipt" ? "selected" : ""}>קבלה</option>
          <option value="form" ${editedFile?.file_type === "form" ? "selected" : ""}>טופס</option>
          <option value="recording" ${editedFile?.file_type === "recording" ? "selected" : ""}>הקלטה</option>
          <option value="other" ${editedFile?.file_type === "other" ? "selected" : ""}>אחר</option>
        </select>
      </div>
      <div class="field wide">
        <label for="file_upload">${editedFile ? "החלפת קובץ" : "קובץ להעלאה"}</label>
        <input id="file_upload" name="upload" type="file" ${editedFile ? "" : "required"} />
        ${
          editedFile?.url
            ? `<small><a href="${html(editedFile.url)}" target="_blank" rel="noopener">קובץ קיים: ${html(editedFile.name || "פתיחה")}</a></small>`
            : ""
        }
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">${editedFile ? "עדכון קובץ" : "העלאת קובץ"}</button>
        ${editedFile ? `<button class="button secondary" data-action="cancel-file-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function templateForm(patientId) {
  const options = state.templates
    .map((template) => `<option value="${html(template.id)}">${html(template.name)}</option>`)
    .join("");

  return `
    <form class="form-grid inline-form" data-form="template-copy" data-patient-id="${html(patientId)}">
      <div class="field">
        <label for="template_id">תבנית</label>
        <select id="template_id" name="template_id" required>
          <option value="">בחירה</option>
          ${options}
        </select>
      </div>
      <div class="field wide">
        <label for="template_name">שם המסמך החדש</label>
        <input id="template_name" name="name" placeholder="למשל: סיכום טיפול - ${html(patientName(patientId))}" />
      </div>
      <div class="toolbar wide">
        <button class="button blue" type="submit" ${state.templates.length ? "" : "disabled"}>יצירת מסמך מתבנית</button>
      </div>
    </form>`;
}

function filesTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th>מטופל</th>
            <th>סוג</th>
            <th>נוצר</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (file) => `
              <tr>
                <td><strong>${html(file.name || "-")}</strong></td>
                <td>${html(patientName(file.patient_id))}</td>
                <td>${html(fileTypeLabel(file.file_type))}</td>
                <td>${html(formatDate((file.created_at || "").slice(0, 10)))}</td>
                <td>
                  <div class="actions">
                    <button class="button secondary table-button" data-action="open-profile" data-id="${html(file.patient_id)}" type="button">כרטיס</button>
                    <button class="button secondary table-button" data-action="edit-file" data-id="${html(file.id)}" type="button">עריכה</button>
                    ${
                      file.url
                        ? `<a class="button table-button" href="${html(file.url)}" target="_blank" rel="noopener">פתיחה</a>`
                        : ""
                    }
                    ${
                      file.file_type === "recording"
                        ? `<button class="button blue table-button" data-action="create-transcript-draft" data-id="${html(file.id)}" type="button">טיוטת תמלול</button>`
                        : ""
                    }
                    <button class="button danger table-button" data-action="delete-file" data-id="${html(file.id)}" type="button">מחיקה</button>
                  </div>
                </td>
              </tr>`
            )
            .join("") || `<tr><td colspan="5"><div class="empty">אין קבצים להצגה.</div></td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function recordingPanel(patient) {
  const isRecording = activeRecordingPatientId === patient.id && activeRecorder?.state === "recording";
  return `
    <div class="recording-box">
      <strong>${isRecording ? "מקליט עכשיו" : "הקלטה"}</strong>
      <button class="button ${isRecording ? "danger" : "blue"}" data-action="${
        isRecording ? "stop-recording" : "start-recording"
      }" data-id="${html(patient.id)}" type="button">${
        isRecording ? "עצירת הקלטה ושמירה" : "התחלת הקלטה"
      }</button>
      <span>הקובץ יישמר בתיקיית המטופל.</span>
    </div>`;
}

function filesPanel(items = state.files, patient = null) {
  const rows = items.slice(0, 6);
  return `
    <article class="panel">
      <div class="panel-head"><h2>קבצים</h2></div>
      ${patient ? fileForm(patient.id) : ""}
      ${patient ? templateForm(patient.id) : ""}
      ${
        patient?.drive_folder_id
          ? `<div class="folder-link">
              <a class="button secondary" href="https://drive.google.com/drive/folders/${html(patient.drive_folder_id)}" target="_blank" rel="noopener">פתיחת תיקיית מטופל</a>
              <button class="button blue" data-action="sync-drive-files" data-id="${html(patient.id)}" type="button">ייבוא קבצים מהתיקייה</button>
            </div>`
          : `<div class="folder-link">
              <button class="button blue" data-action="create-drive-folder" data-id="${html(patient?.id || "")}" type="button">יצירת תיקיית מטופל</button>
            </div>`
      }
      ${filesTable(rows)}
    </article>`;
}

function filteredFiles(rows) {
  return rows.filter((file) => {
    const patientOk = !state.fileFilter.patient || file.patient_id === state.fileFilter.patient;
    const typeOk = !state.fileFilter.type || file.file_type === state.fileFilter.type;
    const textOk =
      !state.fileFilter.text ||
      String(file.name || "").toLowerCase().includes(state.fileFilter.text.toLowerCase()) ||
      patientName(file.patient_id).toLowerCase().includes(state.fileFilter.text.toLowerCase());
    return patientOk && typeOk && textOk;
  });
}

function fileFiltersPanel(total, shown) {
  return `
    <section class="panel compact-panel">
      <div class="panel-head"><h2>סינון קבצים</h2><span>${shown} מתוך ${total}</span></div>
      <div class="form-grid compact-form">
        <div class="field">
          <label for="file_filter_text">חיפוש</label>
          <input id="file_filter_text" data-file-filter="text" value="${html(state.fileFilter.text)}" placeholder="שם קובץ או מטופל" />
        </div>
        <div class="field">
          <label for="file_filter_patient">מטופל</label>
          <select id="file_filter_patient" data-file-filter="patient">
            <option value="" ${state.fileFilter.patient ? "" : "selected"}>כל המטופלים</option>
            ${patientOptions(state.fileFilter.patient)}
          </select>
        </div>
        <div class="field">
          <label for="file_filter_type">סוג</label>
          <select id="file_filter_type" data-file-filter="type">
            <option value="" ${state.fileFilter.type ? "" : "selected"}>כל הסוגים</option>
            <option value="document" ${state.fileFilter.type === "document" ? "selected" : ""}>מסמך</option>
            <option value="summary" ${state.fileFilter.type === "summary" ? "selected" : ""}>סיכום</option>
            <option value="receipt" ${state.fileFilter.type === "receipt" ? "selected" : ""}>קבלה</option>
            <option value="form" ${state.fileFilter.type === "form" ? "selected" : ""}>טופס</option>
            <option value="recording" ${state.fileFilter.type === "recording" ? "selected" : ""}>הקלטה</option>
            <option value="other" ${state.fileFilter.type === "other" ? "selected" : ""}>אחר</option>
          </select>
        </div>
      </div>
    </section>`;
}

function filesPage() {
  const rows = [...state.files].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
  const shownRows = filteredFiles(rows);
  const patientsWithFolders = state.patients.filter((patient) => patient.drive_folder_id).length;

  return shell(`
    ${header(
      "קבצים",
      "",
      `<button class="button secondary" data-action="refresh" type="button">רענון</button>
       ${
         state.config.googleDriveRootFolderId
           ? `<a class="button yellow" href="https://drive.google.com/drive/folders/${html(state.config.googleDriveRootFolderId)}" target="_blank" rel="noopener">פתיחת תיקיית אחסון ראשית</a>`
           : `<a class="button yellow" href="#/settings">הגדרת אחסון</a>`
       }`
    )}
    ${connectionBanner()}
    <section class="metric-row">
      <article class="metric blue-card"><strong>${rows.length}</strong><span>קבצים רשומים</span></article>
      <article class="metric teal-card"><strong>${patientsWithFolders}</strong><span>תיקיות מטופלים</span></article>
      <article class="metric purple-card"><strong>${state.patients.length}</strong><span>מטופלים במערכת</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${state.currentFileId ? "עריכת קובץ" : "קובץ חדש"}</h2></div>
      ${fileForm()}
    </section>
    ${fileFiltersPanel(rows.length, shownRows.length)}
    <section class="panel page-gap">
      <div class="panel-head count-only"><span>${shownRows.length} קבצים</span></div>
      ${filesTable(shownRows)}
    </section>
  `);
}

function formatAgorotAmount(agorot) {
  return new Intl.NumberFormat("he-IL", {
    currency: "ILS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(Number(BusinessCore.agorotToAmountText(agorot)));
}

function formatBusinessAmount(amountText) {
  const agorot = BusinessCore.parseAmountToAgorot(amountText);
  if (agorot === null) return amountText || "-";
  return formatAgorotAmount(agorot);
}

function chargeStatusLabel(status) {
  if (status === "paid") return "שולם";
  if (status === "partial") return "שולם חלקית";
  return "פתוח";
}

function allChargeBalances() {
  return PaymentsCore.chargeBalances(state.sessionCharges, state.paymentAllocations);
}

function patientChargeBalances(patientId, allocations = state.paymentAllocations) {
  return PaymentsCore.chargeBalances(
    state.sessionCharges.filter((charge) => charge.patient_id === patientId),
    allocations
  );
}

function sessionChargeForSession(sessionId) {
  return state.sessionCharges.find((charge) => charge.session_id === sessionId) || null;
}

function businessTypeLabel(recordType) {
  if (recordType === "income") return "הכנסה";
  if (recordType === "expense") return "הוצאה";
  return recordType || "-";
}

function businessRecordYears() {
  const years = new Set([isoDate(new Date()).slice(0, 4), state.businessView.year]);
  for (const record of state.businessRecords) {
    const period = BusinessCore.periodForDate(record.document_date);
    if (period) years.add(period.year);
  }
  return [...years].filter(Boolean).sort((a, b) => b.localeCompare(a));
}

function businessRecordForm() {
  const today = isoDate(new Date());
  const edited = state.currentBusinessRecordId
    ? state.businessRecords.find((record) => record.id === state.currentBusinessRecordId)
    : null;
  return `
    <form class="form-grid inline-form" data-form="business-record" data-id="${html(edited?.id || "")}">
      <div class="field wide">
        <label for="business_document_date">תאריך המסמך</label>
        <input class="picker-input" data-date-input id="business_document_date" name="document_date" readonly required type="text" value="${html(edited?.document_date || today)}" />
      </div>
      <div class="field wide">
        <label for="business_record_type">סוג</label>
        <select id="business_record_type" name="record_type" required>
          <option value="" disabled ${edited ? "" : "selected"}>בחירת סוג</option>
          <option value="income" ${edited?.record_type === "income" ? "selected" : ""}>הכנסה</option>
          <option value="expense" ${edited?.record_type === "expense" ? "selected" : ""}>הוצאה</option>
        </select>
      </div>
      <div class="field wide">
        <label for="business_amount">סכום בשקלים</label>
        <input id="business_amount" name="amount" inputmode="decimal" required placeholder="לדוגמה: 250 או 250.50" value="${html(edited?.amount || "")}" />
      </div>
      <div class="field wide">
        ${
          edited
            ? `<label for="business_document_link">קובץ המסמך</label>
               <small id="business_document_link"><a href="${html(edited.file_url || driveFileUrl(edited.drive_file_id))}" target="_blank" rel="noopener">${html(edited.file_name || "פתיחת המסמך")}</a> — בעריכה משנים תאריך, סוג וסכום בלבד; הקובץ עובר אוטומטית לתיקיית התקופה המתאימה.</small>`
            : `<label for="business_document">קובץ המסמך</label>
               <input id="business_document" name="business_document" type="file" required />`
        }
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">${edited ? "עדכון רשומה" : "העלאה ושמירה"}</button>
        ${edited ? `<button class="button secondary" data-action="cancel-business-edit" type="button">ביטול עריכה</button>` : ""}
      </div>
    </form>`;
}

function businessRecordsTable(records) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>תאריך</th><th>סוג</th><th>סכום</th><th>קובץ</th><th>פעולות</th></tr></thead>
        <tbody>
          ${
            records.length
              ? records
                  .map(
                    (record) => `
                    <tr>
                      <td>${html(formatDate(record.document_date))}</td>
                      <td>${html(businessTypeLabel(record.record_type))}</td>
                      <td>${html(formatBusinessAmount(record.amount))}</td>
                      <td>${html(record.file_name || "-")}</td>
                      <td>
                        <div class="actions">
                          ${
                            record.drive_file_id
                              ? `<a class="button secondary table-button" href="${html(record.file_url || driveFileUrl(record.drive_file_id))}" target="_blank" rel="noopener">פתיחת מסמך</a>`
                              : ""
                          }
                          <button class="button secondary table-button" data-action="edit-business-record" data-id="${html(record.id)}" type="button">עריכה</button>
                          <button class="button danger table-button" data-action="delete-business-record" data-id="${html(record.id)}" type="button">מחיקה</button>
                        </div>
                      </td>
                    </tr>`
                  )
                  .join("")
              : `<tr><td colspan="5"><div class="empty">אין רשומות בתקופה שנבחרה. אפשר להעלות מסמך ראשון בטופס למעלה.</div></td></tr>`
          }
        </tbody>
      </table>
    </div>`;
}

function businessPage() {
  const view = state.businessView;
  const period = BusinessCore.PERIODS.find((item) => item.key === view.period) || BusinessCore.PERIODS[0];
  const periodRecords = sortBusinessRecords(
    BusinessCore.recordsInPeriod(state.businessRecords, view.year, period.key)
  );
  const totals = BusinessCore.summarizeRecords(periodRecords);
  const range = view.range;

  return shell(`
    ${header(
      "ניהול עסק",
      "מעקב הכנסות והוצאות עם תיוק מסמכים לפי תקופות דו-חודשיות",
      `<button class="button secondary" data-action="refresh" type="button">רענון</button>`
    )}
    ${connectionBanner()}
    <section class="panel">
      <div class="panel-head"><h2>בחירת תקופה</h2></div>
      <div class="form-grid">
        <div class="field">
          <label for="business_year">שנה</label>
          <select data-business-filter="year" id="business_year">
            ${businessRecordYears()
              .map((year) => `<option value="${html(year)}" ${year === view.year ? "selected" : ""}>${html(year)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="business_period">תקופה</label>
          <select data-business-filter="period" id="business_period">
            ${BusinessCore.PERIODS.map(
              (item) => `<option value="${html(item.key)}" ${item.key === period.key ? "selected" : ""}>${html(item.label)}</option>`
            ).join("")}
          </select>
        </div>
      </div>
    </section>
    <section class="metric-row">
      <article class="metric teal-card"><strong>${html(formatAgorotAmount(totals.incomeAgorot))}</strong><span>הכנסות בתקופה</span></article>
      <article class="metric pink-card"><strong>${html(formatAgorotAmount(totals.expenseAgorot))}</strong><span>הוצאות בתקופה</span></article>
      <article class="metric blue-card"><strong>${html(formatAgorotAmount(totals.balanceAgorot))}</strong><span>מאזן בתקופה</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>${state.currentBusinessRecordId ? "עריכת רשומה" : "מסמך חדש"}</h2></div>
      ${businessRecordForm()}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>רשומות ${html(period.label)} ${html(view.year)}</h2><span>${periodRecords.length} רשומות</span></div>
      ${businessRecordsTable(periodRecords)}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>סיכום לפי טווח תאריכים</h2><span>החישוב מוצג על המסך בלבד</span></div>
      <form class="form-grid inline-form" data-form="business-range">
        <div class="field">
          <label for="business_range_start">מתאריך</label>
          <input class="picker-input" data-date-input id="business_range_start" name="range_start" readonly type="text" value="${html(view.rangeStart)}" />
        </div>
        <div class="field">
          <label for="business_range_end">עד תאריך</label>
          <input class="picker-input" data-date-input id="business_range_end" name="range_end" readonly type="text" value="${html(view.rangeEnd)}" />
        </div>
        <div class="toolbar wide">
          <button class="button" type="submit">חישוב סיכום</button>
        </div>
      </form>
      ${
        range
          ? `<section class="metric-row">
              <article class="metric teal-card"><strong>${html(formatAgorotAmount(range.incomeAgorot))}</strong><span>הכנסות בטווח</span></article>
              <article class="metric pink-card"><strong>${html(formatAgorotAmount(range.expenseAgorot))}</strong><span>הוצאות בטווח</span></article>
              <article class="metric blue-card"><strong>${html(formatAgorotAmount(range.balanceAgorot))}</strong><span>מאזן בטווח</span></article>
            </section>
            <p>נמצאו ${range.count} רשומות בין ${html(formatDate(range.start))} ל-${html(formatDate(range.end))} (כולל שני התאריכים).</p>`
          : ""
      }
    </section>
  `);
}

function openPatientDrawer(target) {
  drawerReturnFocus = { patientId: target.dataset.id || "" };
  state.currentPatientId = target.dataset.id || "";
  render();
  const drawer = document.getElementById("patientDrawer");
  drawer?.removeAttribute("hidden");
  drawer?.querySelector("input, select, textarea, button")?.focus();
}

function closePatientDrawer() {
  state.currentPatientId = "";
  const drawer = document.getElementById("patientDrawer");
  drawer?.setAttribute("hidden", "");
  const candidates = [...document.querySelectorAll('[data-action="open-patient-drawer"]')];
  const returnTarget = candidates.find(
    (candidate) => (candidate.dataset.id || "") === (drawerReturnFocus?.patientId || "")
  );
  returnTarget?.focus();
  drawerReturnFocus = null;
}

function handleDrawerKeyboard(event) {
  const drawer = document.getElementById("patientDrawer");
  if (!drawer || drawer.hasAttribute("hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closePatientDrawer();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = [...drawer.querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (element) => !element.disabled && !element.hasAttribute("hidden")
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handlePickerKeyboard(event) {
  if (!["Enter", " "].includes(event.key)) return;
  const input = event.target.closest?.("[data-date-input], [data-time-input]");
  if (!input) return;
  event.preventDefault();
  if (input.matches("[data-date-input]")) showDatePicker(input);
  if (input.matches("[data-time-input]")) showTimePicker(input);
}

function patientDrawer() {
  const patient = state.currentPatientId
    ? state.patients.find((item) => item.id === state.currentPatientId)
    : null;
  const title = patient ? "עריכת מטופל" : "הוספת מטופל";
  const submitLabel = patient ? "שמירת שינויים" : "שמירה";

  return `
    <section class="drawer" id="patientDrawer" role="dialog" aria-modal="true" aria-labelledby="patientDrawerTitle" hidden>
      <div class="drawer-inner">
        <div class="panel-head">
          <h2 id="patientDrawerTitle">${title}</h2>
          <button class="button secondary" data-action="close-drawer" type="button">סגירה</button>
        </div>
        <form class="form-grid" data-form="patient" data-id="${html(patient?.id || "")}">
          <div class="field">
            <label for="child_name">שם</label>
            <input id="child_name" name="child_name" required value="${html(patient?.child_name || "")}" />
          </div>
          <div class="field">
            <label for="school_name">מוסד</label>
            <input id="school_name" name="school_name" value="${html(patient?.school_name || "")}" />
          </div>
          <div class="field">
            <label for="treatment_type">סוג טיפול</label>
            <input id="treatment_type" name="treatment_type" value="${html(patient?.treatment_type || "")}" />
          </div>
          <div class="field">
            <label for="fixed_price">מחיר קבוע</label>
            <input id="fixed_price" name="fixed_price" inputmode="decimal" value="${html(patient?.fixed_price || "")}" />
          </div>
          <div class="field">
            <label for="fixed_day">יום קבוע</label>
            <select id="fixed_day" name="fixed_day">
              ${fixedDayOptions(patient?.fixed_day || "")}
            </select>
          </div>
          <div class="field">
            <label for="fixed_time">שעה קבועה</label>
            <input class="picker-input" data-time-input id="fixed_time" name="fixed_time" readonly type="text" value="${html(patient?.fixed_time || "")}" />
          </div>
          <div class="field wide">
            <label for="general_notes">הערות</label>
            <textarea id="general_notes" name="general_notes">${html(patient?.general_notes || "")}</textarea>
          </div>
          <div class="toolbar wide">
            <button class="button" type="submit">${submitLabel}</button>
            <button class="button secondary" data-action="close-drawer" type="button">ביטול</button>
          </div>
        </form>
      </div>
    </section>`;
}

function fixedDayOptions(selectedValue = "") {
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"];
  return [
    `<option value="">בחירה</option>`,
    ...days.map(
      (day) => `<option value="${day}" ${day === selectedValue ? "selected" : ""}>${day}</option>`
    )
  ].join("");
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

function actualSessionExists(patientId, dateValue) {
  return state.sessions.some(
    (session) => session.patient_id === patientId && session.session_date === dateValue
  );
}

function exceptionTypeLabel(type) {
  return {
    cancel: "ביטול חד-פעמי",
    vacation: "חופשה",
    holiday: "חג",
    blocked: "יום חסום"
  }[type] || "חריג יומן";
}

function formatExceptionDateRange(exception) {
  if (!exception?.start_date) return "-";
  if (!exception.end_date || exception.end_date === exception.start_date) {
    return formatDate(exception.start_date);
  }
  return `${formatDate(exception.start_date)} - ${formatDate(exception.end_date)}`;
}

function exceptionApplies(exception, patientId, dateValue) {
  if (!exception?.start_date) return false;
  const endDate = exception.end_date || exception.start_date;
  const appliesToPatient = !exception.patient_id || exception.patient_id === patientId;
  return appliesToPatient && dateValue >= exception.start_date && dateValue <= endDate;
}

function scheduleExceptionsForDate(dateValue, patientId = "") {
  return state.scheduleExceptions.filter((exception) =>
    exceptionApplies(exception, patientId || exception.patient_id || "", dateValue)
  );
}

function recurringBlockedByException(patientId, dateValue) {
  return (
    state.scheduleExceptions.find((exception) => exceptionApplies(exception, patientId, dateValue)) ||
    israelHolidayBlocksRecurring(dateValue)
  );
}

async function saveScheduleException(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.start_date) throw new Error("צריך לבחור תאריך התחלה.");
  const endDate = data.end_date || data.start_date;
  if (endDate < data.start_date) throw new Error("תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.");

  const now = new Date().toISOString();
  const exception = {
    id: id(),
    patient_id: data.patient_id || "",
    exception_type: data.exception_type || "blocked",
    start_date: data.start_date,
    end_date: endDate,
    reason: data.reason || "",
    created_at: now,
    updated_at: now
  };

  const appendResult = await appendSheet("schedule_exceptions", exception);
  exception._rowNumber = appendedRowNumber(appendResult);
  state.scheduleExceptions = [exception, ...state.scheduleExceptions].sort((a, b) =>
    `${b.start_date || ""} ${b.created_at || ""}`.localeCompare(`${a.start_date || ""} ${a.created_at || ""}`)
  );
  return exception;
}

async function deleteScheduleException(exceptionId) {
  const exception = state.scheduleExceptions.find((item) => item.id === exceptionId);
  if (!exception) throw new Error("חריג היומן לא נמצא.");
  if (!exception._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת חריג יומן.");

  await clearSheetRow("schedule_exceptions", exception._rowNumber, exception);
  state.scheduleExceptions = state.scheduleExceptions.filter((item) => item.id !== exceptionId);
}

async function cancelRecurringSession(patientId, dateValue) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error("המטופל לא נמצא.");
  if (!recurringSessionForDate(patient, dateValue)) throw new Error("לא נמצא מפגש קבוע לביטול בתאריך הזה.");

  const now = new Date().toISOString();
  const exception = {
    id: id(),
    patient_id: patientId,
    exception_type: "cancel",
    start_date: dateValue,
    end_date: dateValue,
    reason: "ביטול חד-פעמי מתוך היומן",
    created_at: now,
    updated_at: now
  };
  const appendResult = await appendSheet("schedule_exceptions", exception);
  exception._rowNumber = appendedRowNumber(appendResult);
  state.scheduleExceptions = [exception, ...state.scheduleExceptions];
  return exception;
}

function recurringSessionForDate(patient, dateValue) {
  if (!patient?.id || patient.status === "archived") return null;
  if (!patient.fixed_day || !patient.fixed_time) return null;
  const date = dateFromInput(dateValue);
  if (fixedDayIndex(patient.fixed_day) !== date.getDay()) return null;
  if (actualSessionExists(patient.id, dateValue)) return null;
  const exception = recurringBlockedByException(patient.id, dateValue);
  if (exception) return null;

  return {
    id: `recurring-${patient.id}-${dateValue}`,
    patient_id: patient.id,
    session_date: dateValue,
    start_time: patient.fixed_time,
    end_time: "",
    location: optionValues(state.config.sessionLocations, DEFAULT_SESSION_LOCATIONS)[0] || "",
    session_type: "מפגש קבוע",
    summary: "מפגש קבוע לפי הגדרת המטופל.",
    sensitive_notes: "",
    calendar_event_id: "",
    created_at: "",
    updated_at: "",
    document_file_id: "",
    is_recurring: true
  };
}

async function materializeRecurringSession(patientId, dateValue) {
  const existing = state.sessions.find(
    (session) => session.patient_id === patientId && session.session_date === dateValue
  );
  if (existing) return existing;

  const patient = state.patients.find((item) => item.id === patientId);
  const recurring = recurringSessionForDate(patient, dateValue);
  if (!recurring) throw new Error("לא נמצא מפגש קבוע לשמירה.");

  const now = new Date().toISOString();
  const session = {
    id: id(),
    patient_id: patientId,
    session_date: recurring.session_date,
    start_time: recurring.start_time,
    end_time: recurring.end_time || addMinutes(recurring.start_time, 50),
    location: recurring.location,
    session_type: recurring.session_type,
    summary: recurring.summary,
    sensitive_notes: "",
    calendar_event_id: "",
    created_at: now,
    updated_at: now,
    document_file_id: ""
  };

  lastCalendarSyncError = "";
  lastDocumentSyncError = "";
  try {
    session.calendar_event_id = await createCalendarEvent(session);
  } catch {
    queueSyncWork("calendar_upsert", session.id, {});
    lastCalendarSyncError = "היומן עדיין לא הסתנכרן; המערכת תנסה שוב אוטומטית.";
  }

  const appendResult = await appendSheet("sessions", session);
  session._rowNumber = appendedRowNumber(appendResult);
  state.sessions = [session, ...state.sessions];

  try {
    const documentFileId = await updateSessionDocument(patientId, session);
    if (documentFileId) {
      session.document_file_id = documentFileId;
      if (session._rowNumber) await updateSheetRow("sessions", session._rowNumber, session);
      state.sessions = state.sessions.map((item) => (item.id === session.id ? session : item));
    }
  } catch {
    queueSyncWork("document_upsert", session.id, {});
    lastDocumentSyncError = "מסמך התיעוד עדיין לא הסתנכרן; המערכת תנסה שוב אוטומטית.";
  }

  state.sessions = state.sessions.sort((a, b) =>
    `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
  );
  return session;
}

function dateRange(startDateValue, numberOfDays) {
  const start = dateFromInput(startDateValue);
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return isoDate(date);
  });
}

function sessionsForDates(dateValues) {
  const wantedDates = new Set(dateValues);
  const actualSessions = state.sessions.filter((session) => wantedDates.has(session.session_date));
  const recurringSessions = dateValues.flatMap((dateValue) =>
    state.patients
      .map((patient) => recurringSessionForDate(patient, dateValue))
      .filter(Boolean)
  );

  return [...actualSessions, ...recurringSessions].sort((a, b) =>
    `${a.session_date} ${a.start_time}`.localeCompare(`${b.session_date} ${b.start_time}`)
  );
}

function patientName(patientId) {
  return state.patients.find((patient) => patient.id === patientId)?.child_name || "ללא מטופל";
}

function sessionLabel(session) {
  if (!session) return "מפגש";
  const date = formatDate(session.session_date);
  const time = [session.start_time, session.end_time].filter(Boolean).join("-");
  const type = session.session_type || "מפגש";
  return [date, time, type].filter(Boolean).join(" | ");
}

function sessionLabelById(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  return session ? sessionLabel(session) : "מפגש משויך";
}

function paymentStatusLabel(value) {
  return {
    paid: "שולם",
    partial: "חלקי",
    pending: "ממתין",
    unpaid: "פתוח"
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

async function connectGoogle(forceConsent = false, automatic = false) {
  if (googleAuthInFlight) return;
  state.error = "";
  state.message = "";
  state.authRestoring = automatic;
  if (forceConsent) {
    clearStoredGoogleToken(true);
    state.accessToken = "";
  }

  if (!state.config.googleClientId) {
    state.authRestoring = false;
    state.error = "צריך להכניס מזהה התחברות במסך ההגדרות.";
    navigate("settings");
    render();
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    state.authRestoring = false;
    state.error = "רכיב ההתחברות עדיין לא נטען. נסו שוב בעוד רגע.";
    render();
    return;
  }

  googleAuthInFlight = true;
  state.message = automatic ? "" : "נפתח חלון Google. יש לבחור חשבון ולאשר את ההרשאות.";
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.googleClientId,
    scope:
      "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/forms.responses.readonly",
    callback: async (response) => {
      googleAuthInFlight = false;
      state.authRestoring = false;
      state.message = "";
      if (response.error) {
        state.error = automatic
          ? "החיבור השמור ממתין לאישור קצר של Google. לחצו התחברות כדי להמשיך."
          : "ההתחברות לאחסון נכשלה.";
        render();
        return;
      }

      state.accessToken = response.access_token;
      saveGoogleToken(response);
      try {
        await loadGoogleUser();
        await loadData();
        state.error = "";
        state.message = automatic ? "החיבור לחשבון Google שוחזר אוטומטית." : "החיבור לחשבון Google הושלם.";
      } catch (error) {
        state.error = error instanceof Error ? error.message : "בדיקת ההרשאה נכשלה.";
      }
      render();
    },
    error_callback: (error) => {
      googleAuthInFlight = false;
      state.authRestoring = false;
      state.message = "";
      const errorType = error?.type || "";
      const errorDetails = `${errorType} ${error?.message || ""}`.toLowerCase();
      state.error = errorDetails.includes("invalid_request")
        ? "Google דחה את בקשת ההתחברות בגלל הגדרת הרשאות חסרה בפרויקט. מנהל המערכת צריך לעדכן את הרשאות Google ואז לנסות שוב."
        : errorType === "popup_failed_to_open"
        ? "חלון Google נחסם על ידי הדפדפן. יש לאפשר חלונות קופצים לאתר ולנסות שוב."
        : errorType === "popup_closed"
          ? "חלון ההתחברות נסגר לפני שהאישור הושלם. אפשר ללחוץ שוב על התחברות."
          : automatic
            ? "לא ניתן היה לשחזר את החיבור אוטומטית. לחצו התחברות כדי להמשיך."
            : "לא ניתן לפתוח את ההתחברות ל-Google. יש לנסות שוב.";
      render();
    }
  });

  try {
    render();
    tokenClient.requestAccessToken({
      prompt: forceConsent || localStorage.getItem(GOOGLE_CONSENT_KEY) !== "yes" ? "consent" : ""
    });
  } catch (error) {
    googleAuthInFlight = false;
    state.authRestoring = false;
    state.message = "";
    state.error = automatic
      ? "לא ניתן היה לשחזר את החיבור אוטומטית. לחצו התחברות כדי להמשיך."
      : error instanceof Error
        ? error.message
        : "ההתחברות לאחסון נכשלה.";
    render();
  }
}

function waitForGoogleIdentity(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(check, 100);
    };
    check();
  });
}

async function restoreGoogleSession() {
  if (state.accessToken) {
    scheduleGoogleTokenRenewal();
    await loadData();
    return;
  }

  if (localStorage.getItem(GOOGLE_CONSENT_KEY) !== "yes") return;
  if (Date.now() - lastGoogleRestoreAttempt < 60_000) return;
  lastGoogleRestoreAttempt = Date.now();
  state.authRestoring = true;
  render();
  const ready = await waitForGoogleIdentity();
  if (!ready) {
    state.authRestoring = false;
    state.error = "רכיב ההתחברות של Google לא נטען. לחצו התחברות כדי לנסות שוב.";
    render();
    return;
  }
  await connectGoogle(false, true);
}

function clearClinicData() {
  state.patients = [];
  state.sessions = [];
  state.payments = [];
  state.tasks = [];
  state.files = [];
  state.contacts = [];
  state.goals = [];
  state.goalUpdates = [];
  state.questionnaireTemplates = [];
  state.questionnaireAssignments = [];
  state.questionnaireResponses = [];
  state.clinicalReports = [];
  state.businessRecords = [];
  state.sessionCharges = [];
  state.paymentAllocations = [];
  state.scheduleExceptions = [];
  state.auditLog = [];
  state.lastUndoActionId = "";
  state.templates = [];
}

function disconnectGoogle() {
  const token = state.accessToken;
  if (token && window.google?.accounts?.oauth2?.revoke) {
    google.accounts.oauth2.revoke(token, () => {});
  }
  clearStoredGoogleToken(true);
  state.accessToken = "";
  state.googleUser = null;
  state.authChecked = false;
  state.authRestoring = false;
  clearClinicData();
  state.message = "החיבור לחשבון Google נותק מהמכשיר הזה.";
  state.error = "";
  render();
}

function friendlyGoogleError(text, status) {
  let message = text || "";

  try {
    const parsed = JSON.parse(text);
    message = parsed?.error?.message || parsed?.message || message;
  } catch {
    // Google sometimes returns plain text or HTML. In that case use the raw text.
  }

  const combined = `${text || ""} ${message}`.toLowerCase();
  const failureKind = WorkflowCore.googleFailure(status, combined);

  if (combined.includes("sheets.googleapis.com") || combined.includes("google sheets api")) {
    return "רכיב מאגר הנתונים לא פעיל בפרויקט החיבור. במסך ההגדרות לחץ על הפעלת מאגר נתונים, המתן דקה ואז לחץ בדיקת חיבור.";
  }

  if (combined.includes("drive.googleapis.com") || combined.includes("google drive api")) {
    return "רכיב אחסון הקבצים לא פעיל בפרויקט החיבור. במסך ההגדרות לחץ על הפעלת אחסון קבצים, המתן דקה ואז לחץ בדיקת חיבור.";
  }

  if (combined.includes("calendar.googleapis.com") || combined.includes("google calendar api")) {
    return "רכיב היומן לא פעיל בפרויקט החיבור. צריך להפעיל את Google Calendar API ואז להתחבר מחדש עם הרשאות.";
  }

  if (combined.includes("docs.googleapis.com") || combined.includes("google docs api")) {
    return "רכיב המסמכים לא פעיל בפרויקט החיבור. צריך להפעיל את Google Docs API ואז להתחבר מחדש עם הרשאות.";
  }

  if (combined.includes("forms.googleapis.com") || combined.includes("google forms api")) {
    return "רכיב השאלונים לא פעיל בפרויקט החיבור. צריך להפעיל את Google Forms API ואז להתחבר מחדש עם הרשאות.";
  }

  if (status === 401 || combined.includes("invalid credentials")) {
    clearStoredGoogleToken();
    state.accessToken = "";
    state.googleUser = null;
    state.authChecked = false;
    clearClinicData();
    return "החיבור פג תוקף. צריך להתחבר שוב.";
  }

  if (
    status === 403 ||
    combined.includes("insufficient") ||
    combined.includes("access denied") ||
    combined.includes("insufficient authentication scopes")
  ) {
    clearStoredGoogleToken(true);
    state.accessToken = "";
    state.googleUser = null;
    state.authChecked = false;
    clearClinicData();
    return "חסרה הרשאה לאחסון קבצים. צריך להתחבר שוב ולאשר את כל ההרשאות המבוקשות.";
  }

  if (failureKind === "rate_limit") return "Google מגביל זמנית את מספר הפעולות. יש להמתין מעט ולנסות שוב.";
  if (failureKind === "temporary") return "שירות Google אינו זמין זמנית. הנתונים לא סומנו כשמורים; יש לנסות שוב בעוד רגע.";
  if (failureKind === "not_found") return "המשאב המבוקש ב-Google לא נמצא. יש לבדוק את המזהים וההרשאות במסך ההגדרות.";

  return message || "הקריאה לאחסון נכשלה.";
}

async function googleFetch(url, options = {}) {
  if (!state.accessToken) throw new Error("לא מחוברים לאחסון.");
  const { acceptStatuses = [], ...fetchOptions } = options;
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {})
    }
  });

  if (acceptStatuses.includes(response.status)) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(friendlyGoogleError(text, response.status));
  }

  return response.status === 204 ? null : response.json();
}

async function googleFetchBlob(url, options = {}) {
  if (!state.accessToken) throw new Error("לא מחוברים לאחסון.");
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${state.accessToken}`, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(friendlyGoogleError(text, response.status));
  }
  return response.blob();
}

async function loadGoogleUser() {
  if (!state.accessToken) {
    state.googleUser = null;
    state.authChecked = false;
    return null;
  }

  const profile = await googleFetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {}
  });
  if (profile?.email_verified !== true) {
    clearStoredGoogleToken();
    state.accessToken = "";
    state.googleUser = null;
    state.authChecked = false;
    throw new Error("Google לא אישר את כתובת האימייל של החשבון המחובר.");
  }
  state.googleUser = {
    email: profile?.email || "",
    name: profile?.name || ""
  };
  state.authChecked = true;

  if (!isAuthorizedGoogleUser()) {
    clearClinicData();
    clearStoredGoogleToken();
    state.accessToken = "";
    throw new Error("החשבון המחובר לא מורשה להשתמש במערכת הזו.");
  }

  localStorage.setItem(GOOGLE_ACCOUNT_KEY, state.googleUser.email);

  return state.googleUser;
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

async function readSheet(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  if (!spreadsheetId) return [];
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A2:${columnLetter(columns.length)}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const result = await googleFetch(url);
  return (result.values || [])
    .map((row, index) => loadedSheetRecord(columns, row, String(index + 2)))
    .filter((record) => columns.some((column) => record[column]));
}

function loadedSheetRecord(columns, row, rowNumber) {
  const record = { ...rowToRecord(columns, row), _rowNumber: String(rowNumber) };
  record._loadedVersion = WorkflowCore.recordVersion(record);
  return record;
}

async function getSpreadsheetSheetNames() {
  const spreadsheetId = state.config.googleSpreadsheetId;
  if (!spreadsheetId) throw new Error("לא הוגדר מזהה מאגר נתונים.");
  const result = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  );
  return (result.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
}

async function readSheetHeader(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const range = `${sheetName}!1:1`;
  const result = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`
  );
  return result.values?.[0] || [];
}

async function writeSheetHeader(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A1:${columnLetter(columns.length)}1`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  url.searchParams.set("valueInputOption", "RAW");
  await googleFetch(url.toString(), {
    method: "PUT",
    body: JSON.stringify({ values: [columns] })
  });
}

async function addMissingSheets(sheetNames) {
  if (!sheetNames.length) return;
  const spreadsheetId = state.config.googleSpreadsheetId;
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: sheetNames.map((title) => ({
        addSheet: {
          properties: { title }
        }
      }))
    })
  });
}

function healthRow(sheet, existingSheets, header) {
  if (!existingSheets.includes(sheet)) {
    return { sheet, ok: false, message: "הגיליון חסר." };
  }
  const expected = SHEETS[sheet];
  const missing = expected.filter((column, index) => header[index] !== column);
  if (missing.length) {
    return {
      sheet,
      ok: false,
      message: `שורת הכותרות לא תואמת. חסר/שונה: ${missing.join(", ")}`
    };
  }
  return { sheet, ok: true, message: "תקין." };
}

async function runDataHealthCheck({ repair = false } = {}) {
  if (!canUseStorage()) throw new Error("צריך להתחבר לחשבון מורשה לפני בדיקת תקינות.");
  const sheetNames = Object.keys(SHEETS);
  let existingSheets = await getSpreadsheetSheetNames();
  const missingSheets = sheetNames.filter((sheet) => !existingSheets.includes(sheet));

  if (repair && missingSheets.length) {
    await addMissingSheets(missingSheets);
    existingSheets = await getSpreadsheetSheetNames();
  }

  const results = [];
  for (const sheet of sheetNames) {
    if (!existingSheets.includes(sheet)) {
      results.push(healthRow(sheet, existingSheets, []));
      continue;
    }
    let header = await readSheetHeader(sheet).catch(() => []);
    let row = healthRow(sheet, existingSheets, header);
    if (repair && !row.ok) {
      // Repair may only write a header into an empty header row (a new sheet).
      // A mismatched existing header is reported and never rewritten, because
      // rewriting headers without migrating the data rows corrupts alignment.
      const headerIsEmpty = !header.some((cell) => String(cell ?? "").trim());
      if (headerIsEmpty) {
        await writeSheetHeader(sheet);
        header = await readSheetHeader(sheet).catch(() => []);
        row = healthRow(sheet, existingSheets, header);
      } else {
        row = {
          ...row,
          message: `${row.message} לא בוצע תיקון אוטומטי כדי לא לפגוע בנתונים קיימים – יש לתקן את שורת הכותרות ידנית.`
        };
      }
    }
    results.push(row);
  }

  const report = {
    checked_at: new Date().toISOString(),
    repaired: repair,
    ok: results.every((row) => row.ok),
    results
  };
  state.dataHealth = report;
  return report;
}

async function ensureSpreadsheetSchema() {
  const spreadsheetId = state.config.googleSpreadsheetId || "";
  if (!spreadsheetId || state.storageReadySpreadsheetId === spreadsheetId) return;

  const report = await runDataHealthCheck({ repair: true });
  if (!report.ok) {
    const failedSheets = report.results
      .filter((row) => !row.ok)
      .map((row) => row.sheet)
      .join(", ");
    throw new Error(`מבנה מאגר הנתונים לא תקין: ${failedSheets || "נדרש תיקון בגיליון"}.`);
  }

  state.storageReadySpreadsheetId = spreadsheetId;
}

async function seedQuestionnaireTemplates() {
  if (state.questionnaireTemplates.length) return;
  for (const template of DEFAULT_QUESTIONNAIRE_TEMPLATES) {
    const now = new Date().toISOString();
    const record = {
      id: template.id,
      name: template.name,
      audience: template.audience,
      questions_json: JSON.stringify(template.questions),
      active: "yes",
      created_at: now,
      updated_at: now
    };
    const result = await appendSheet("questionnaire_templates", record);
    record._rowNumber = appendedRowNumber(result);
    state.questionnaireTemplates.push(record);
  }
}

async function migrateLegacyGoals() {
  for (const patient of state.patients) {
    const legacyText = String(patient.treatment_goals || "").trim();
    if (!legacyText || state.goals.some((goal) => goal.patient_id === patient.id && goal.legacy_source === "patients.treatment_goals")) continue;
    const now = new Date().toISOString();
    const goal = {
      id: `legacy-goal-${patient.id}`,
      patient_id: patient.id,
      title: "מטרות קיימות",
      description: legacyText,
      status: "active",
      progress: "0",
      target_date: "",
      note: "הועבר מהשדה הישן ללא מחיקת המקור.",
      legacy_source: "patients.treatment_goals",
      created_at: patient.created_at || now,
      updated_at: now
    };
    const result = await appendSheet("goals", goal);
    goal._rowNumber = appendedRowNumber(result);
    state.goals.push(goal);
  }
}

async function appendSheet(sheetName, record) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A:${columnLetter(columns.length)}`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append`
  );
  url.searchParams.set("valueInputOption", "RAW");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  const result = await googleFetch(url.toString(), {
    method: "POST",
    body: JSON.stringify({ values: [recordToRow(columns, record)] })
  });
  record._loadedVersion = WorkflowCore.recordVersion(record);
  return result;
}

function appendedRowNumber(result) {
  const range = result?.updates?.updatedRange || "";
  return range.match(/![A-Z]+(\d+):/)?.[1] || "";
}

async function readSheetRow(sheetName, rowNumber) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A${rowNumber}:${columnLetter(columns.length)}${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const result = await googleFetch(url);
  const row = result.values?.[0];
  if (!row || !columns.some((_, index) => row[index])) return null;
  return loadedSheetRecord(columns, row, rowNumber);
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

async function refreshSheetState(sheetName) {
  const collectionName = stateCollectionName(sheetName);
  if (!Array.isArray(state[collectionName])) return;
  state[collectionName] = await readSheet(sheetName);
}

async function assertSheetRowCurrent(sheetName, rowNumber, expectedRecord) {
  const current = await readSheetRow(sheetName, rowNumber);
  if (!WorkflowCore.rowConflict(current, expectedRecord)) return current;
  await refreshSheetState(sheetName).catch(() => {});
  const error = new Error("הרשומה השתנתה בידי משתמש אחר. הנתונים רועננו; יש לבדוק את השינויים ולנסות שוב.");
  error.code = "ROW_CONFLICT";
  throw error;
}

async function updateSheetRow(sheetName, rowNumber, record, expectedRecord = record) {
  await assertSheetRowCurrent(sheetName, rowNumber, expectedRecord);
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A${rowNumber}:${columnLetter(columns.length)}${rowNumber}`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  url.searchParams.set("valueInputOption", "RAW");
  await googleFetch(url.toString(), {
    method: "PUT",
    body: JSON.stringify({ values: [recordToRow(columns, record)] })
  });
  record._loadedVersion = WorkflowCore.recordVersion(record);
}

async function clearSheetRow(sheetName, rowNumber, expectedRecord) {
  await assertSheetRowCurrent(sheetName, rowNumber, expectedRecord);
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A${rowNumber}:${columnLetter(columns.length)}${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
  await googleFetch(url, {
    method: "POST",
    body: JSON.stringify({})
  });
}

function workflowCollections() {
  return {
    patients: state.patients,
    sessions: state.sessions,
    payments: state.payments,
    tasks: state.tasks,
    files: state.files,
    contacts: state.contacts,
    goals: state.goals,
    goal_updates: state.goalUpdates,
    questionnaire_templates: state.questionnaireTemplates,
    questionnaire_assignments: state.questionnaireAssignments,
    questionnaire_responses: state.questionnaireResponses,
    clinical_reports: state.clinicalReports,
    schedule_exceptions: state.scheduleExceptions,
    business_records: state.businessRecords,
    session_charges: state.sessionCharges,
    payment_allocations: state.paymentAllocations
  };
}

function auditMutations(entry) {
  try {
    const rows = JSON.parse(entry?.mutations_json || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

let activeAuditAction = false;

async function appendAuditEntry(meta, mutations) {
  const now = new Date().toISOString();
  const entry = {
    id: id(),
    action_type: meta.actionType || "update",
    entity_type: meta.entityType || "system",
    entity_id: meta.entityId || mutations?.find((mutation) => mutation.after?.id)?.after?.id || mutations?.find((mutation) => mutation.before?.id)?.before?.id || "",
    summary: meta.summary || "פעולה במערכת",
    actor_email: state.googleUser?.email || "",
    mutations_json: JSON.stringify(mutations || []),
    undoable: meta.undoable === false ? "no" : "yes",
    undone_at: "",
    created_at: now
  };
  const result = await appendSheet("audit_log", entry);
  entry._rowNumber = appendedRowNumber(result);
  state.auditLog = [entry, ...state.auditLog].slice(0, 200);
  state.lastUndoActionId = entry.undoable === "yes" && mutations.length ? entry.id : "";
  return entry;
}

async function applyAuditMutations(mutations) {
  for (const mutation of mutations) {
    if (!mutation.rowNumber || !SHEETS[mutation.table]) throw new Error("רישום ה-Audit אינו מכיל מיקום שחזור תקין.");
    const collection = state[stateCollectionName(mutation.table)] || [];
    const expected = collection.find((record) => record.id === mutation.before?.id) || mutation.before;
    if (mutation.after) await updateSheetRow(mutation.table, mutation.rowNumber, mutation.after, expected);
    else await clearSheetRow(mutation.table, mutation.rowNumber, expected);
  }
}

async function runAuditedAction(meta, work) {
  if (activeAuditAction) return work();
  activeAuditAction = true;
  setSaveState("saving");
  const before = WorkflowCore.snapshot(workflowCollections());
  try {
    const result = await work();
    const after = WorkflowCore.snapshot(workflowCollections());
    const mutations = WorkflowCore.diff(before, after);
    await appendAuditEntry(meta, mutations);
    setSaveState(state.syncQueue.length ? "pending" : "saved");
    return result;
  } catch (error) {
    const afterFailure = WorkflowCore.snapshot(workflowCollections());
    const partialMutations = WorkflowCore.diff(before, afterFailure);
    if (partialMutations.length && meta.undoable !== false) {
      try {
        await applyAuditMutations(WorkflowCore.inverse(partialMutations));
        await loadData();
      } catch (rollbackError) {
        await appendAuditEntry(
          { ...meta, actionType: "failed_partial", summary: `${meta.summary || "פעולה"} — נכשלה חלקית`, undoable: false },
          partialMutations
        ).catch(() => {});
        throw new Error(`הפעולה נכשלה וגם ההחזרה לאחור נכשלה: ${rollbackError.message || rollbackError}`);
      }
      await appendAuditEntry(
        { ...meta, actionType: "failed_rollback", summary: `${meta.summary || "פעולה"} — נכשלה והוחזרה לאחור`, undoable: false },
        []
      ).catch(() => {});
    } else if (partialMutations.length) {
      await appendAuditEntry(
        { ...meta, actionType: "failed_partial", summary: `${meta.summary || "פעולה"} — נכשלה חלקית`, undoable: false },
        partialMutations
      ).catch(() => {});
    }
    setSaveState(state.syncQueue.length ? "pending" : "error");
    throw error;
  } finally {
    activeAuditAction = false;
  }
}

async function undoAuditAction(actionId) {
  const entry = state.auditLog.find((item) => item.id === actionId);
  if (!entry || entry.undoable !== "yes" || entry.undone_at) throw new Error("הפעולה אינה זמינה לביטול.");
  const mutations = auditMutations(entry);
  if (!Array.isArray(mutations) || !mutations.length) throw new Error("אין שינויי נתונים לביטול.");

  await applyAuditMutations(WorkflowCore.inverse(mutations));

  const updated = { ...entry, undone_at: new Date().toISOString() };
  await updateSheetRow("audit_log", entry._rowNumber, updated);
  await loadData();
  await appendAuditEntry(
    {
      actionType: "undo",
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      summary: `ביטול: ${entry.summary}`,
      undoable: false
    },
    []
  );
  state.lastUndoActionId = "";
}

async function checkStorageConnection() {
  if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני בדיקה.");
  if (!state.config.googleSpreadsheetId) throw new Error("לא הוגדר מזהה מאגר נתונים.");
  if (!state.config.googleDriveRootFolderId) throw new Error("לא הוגדרה תיקיית אחסון ראשית.");

  await ensureSpreadsheetSchema();

  const rootFolder = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      state.config.googleDriveRootFolderId
    )}?fields=id,name,mimeType`,
    { headers: {} }
  );

  if (rootFolder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("תיקיית האחסון הראשית אינה מזוהה כתיקייה.");
  }

  return rootFolder.name || "תיקיית האחסון";
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

function privateCalendarEventBody(session) {
  const endTime = session.end_time || addMinutes(session.start_time, 50);
  return {
    summary: "פגישה בקליניקה",
    description: "",
    visibility: "private",
    start: {
      dateTime: calendarDateTime(session.session_date, session.start_time),
      timeZone: "Asia/Jerusalem"
    },
    end: {
      dateTime: calendarDateTime(session.session_date, endTime),
      timeZone: "Asia/Jerusalem"
    }
  };
}

async function createCalendarEvent(session) {
  if (!session.session_date || !session.start_time) return "";
  const calendarId = state.config.googleCalendarId || "primary";
  const body = privateCalendarEventBody(session);
  const result = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
  return result.id || "";
}

async function updateCalendarEvent(session) {
  if (!session.calendar_event_id) return createCalendarEvent(session);
  if (!session.session_date || !session.start_time) return session.calendar_event_id;
  const calendarId = state.config.googleCalendarId || "primary";
  const body = privateCalendarEventBody(session);
  const result = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(session.calendar_event_id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body)
    }
  );
  return result.id || session.calendar_event_id;
}

async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  const calendarId = state.config.googleCalendarId || "primary";
  await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      // 404/410 mean the event is already gone, which is the desired final state.
      acceptStatuses: [404, 410]
    }
  );
}

function sessionDocumentText(patient, session) {
  return [
    `תיעוד מפגש - ${patient.child_name || patientName(session.patient_id)}`,
    "",
    `תאריך: ${formatDate(session.session_date)}`,
    `שעה: ${[session.start_time, session.end_time].filter(Boolean).join("-") || "-"}`,
    `סוג מפגש: ${session.session_type || "-"}`,
    `מיקום: ${session.location || "-"}`,
    "",
    "תיעוד טיפול:",
    session.summary || "",
    "",
    "הערות פנימיות:",
    session.sensitive_notes || ""
  ].join("\n");
}

function sessionDocumentTitle(patient, session) {
  return `תיעוד מפגש - ${patient.child_name || "מטופל"} - ${session.session_date} - ${String(
    session.id
  ).slice(0, 8)}`;
}

function sessionDocumentRecord(session) {
  if (session.document_file_id) {
    const byId = state.files.find((file) => file.drive_file_id === session.document_file_id);
    if (byId) return byId;
  }
  return state.files.find(
    (file) =>
      file.patient_id === session.patient_id &&
      file.file_type === "summary" &&
      file.name &&
      file.name.includes(String(session.id).slice(0, 8))
  );
}

async function replaceDocumentText(documentId, text) {
  const document = await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    { headers: {} }
  );
  const content = document.body?.content || [];
  const endIndex = content.length ? content[content.length - 1].endIndex : 1;
  const requests = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1
        }
      }
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text
    }
  });
  await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests })
    }
  );
}

async function createSessionDocument(patientId, session) {
  const patient = await ensurePatientDriveFolder(patientId);
  const existingRecord = sessionDocumentRecord(session);
  if (existingRecord?.drive_file_id) {
    await replaceDocumentText(existingRecord.drive_file_id, sessionDocumentText(patient, session));
    return existingRecord;
  }

  const title = sessionDocumentTitle(patient, session);
  const documentFile = await googleFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,createdTime",
    {
      method: "POST",
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: [patient.drive_folder_id]
      })
    }
  );

  await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentFile.id)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: sessionDocumentText(patient, session)
            }
          }
        ]
      })
    }
  );

  return appendFileRecord({
    id: id(),
    patient_id: patientId,
    drive_file_id: documentFile.id || "",
    drive_folder_id: patient.drive_folder_id || "",
    name: documentFile.name || title,
    file_type: "summary",
    url: documentFile.webViewLink || driveFileUrl(documentFile.id),
    created_at: documentFile.createdTime || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

async function updateSessionDocument(patientId, session) {
  const file = await createSessionDocument(patientId, session);
  return file?.drive_file_id || "";
}

async function persistSessionExternalId(session, field, value) {
  if (!session?._rowNumber || session[field] === value) return;
  const updated = { ...session, [field]: value, updated_at: new Date().toISOString() };
  await updateSheetRow("sessions", session._rowNumber, updated, session);
  state.sessions = state.sessions.map((item) => (item.id === session.id ? updated : item));
}

async function processSyncItem(item) {
  if (item.kind === "calendar_delete") {
    await deleteCalendarEvent(item.payload?.eventId || "");
    return;
  }

  const session = state.sessions.find((row) => row.id === item.entityId);
  if (!session) return;

  if (item.kind === "calendar_upsert") {
    const eventId = session.calendar_event_id
      ? await updateCalendarEvent(session)
      : await createCalendarEvent(session);
    if (eventId) await persistSessionExternalId(session, "calendar_event_id", eventId);
    return;
  }

  if (item.kind === "document_upsert") {
    const documentId = await updateSessionDocument(session.patient_id, session);
    if (documentId) await persistSessionExternalId(session, "document_file_id", documentId);
  }
}

async function processSyncQueue(force = false) {
  if (syncProcessing || !state.syncQueue.length || !canUseStorage() || !navigator.onLine) return;
  syncProcessing = true;
  updateSyncIndicator();
  const now = Date.now();

  try {
    for (const item of [...state.syncQueue]) {
      if (!force && Number(item.nextAttemptAt || 0) > now) continue;
      try {
        await processSyncItem(item);
        removeSyncWork(item.id);
      } catch (error) {
        const current = state.syncQueue.find((row) => row.id === item.id);
        if (!current) continue;
        current.attempts = Number(current.attempts || 0) + 1;
        current.lastError = error instanceof Error ? error.message : "הסנכרון נכשל.";
        current.updatedAt = new Date().toISOString();
        current.nextAttemptAt = Date.now() + Math.min(15 * 60_000, 5000 * 2 ** Math.min(current.attempts, 7));
        state.saveState = "pending";
        persistSyncQueue();
      }
    }
  } finally {
    syncProcessing = false;
    updateSyncIndicator();
    if (state.syncQueue.length) {
      const nextAt = Math.min(...state.syncQueue.map((item) => Number(item.nextAttemptAt || Date.now() + 5000)));
      scheduleSyncRetry(Math.max(1000, nextAt - Date.now()));
    }
  }
}

function queueCalendarPrivacyMigration() {
  if (localStorage.getItem(CALENDAR_PRIVACY_MIGRATION_KEY) === "queued") return;
  for (const session of state.sessions.filter((item) => item.calendar_event_id)) {
    queueSyncWork("calendar_upsert", session.id, { reason: "privacy_cleanup" });
  }
  localStorage.setItem(CALENDAR_PRIVACY_MIGRATION_KEY, "queued");
}

function recordingTranscriptTitle(patient, recordingFile) {
  return `טיוטת תמלול - ${patient.child_name || patientName(recordingFile.patient_id)} - ${String(
    recordingFile.created_at || isoDate(new Date())
  ).slice(0, 10)} - ${String(recordingFile.id).slice(0, 8)}`;
}

function recordingTranscriptText(patient, recordingFile) {
  return [
    recordingTranscriptTitle(patient, recordingFile),
    "",
    `מטופל: ${patient.child_name || patientName(recordingFile.patient_id)}`,
    `קובץ הקלטה: ${recordingFile.name || "-"}`,
    `תאריך הקלטה: ${formatDate(String(recordingFile.created_at || "").slice(0, 10))}`,
    recordingFile.drive_file_id ? `קישור להקלטה: ${driveFileUrl(recordingFile.drive_file_id)}` : "",
    "",
    "תמלול גולמי:",
    "",
    "כאן ייכנס התמלול לאחר עיבוד.",
    "",
    "ניקוי ועריכה:",
    "",
    "נקודות טיפוליות:",
    "",
    "משימות המשך:"
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function createRecordingTranscriptDraft(fileId) {
  const recordingFile = state.files.find((file) => file.id === fileId);
  if (!recordingFile) throw new Error("קובץ ההקלטה לא נמצא.");
  if (recordingFile.file_type !== "recording") throw new Error("אפשר ליצור טיוטת תמלול רק מקובץ הקלטה.");

  const existing = state.files.find(
    (file) =>
      file.patient_id === recordingFile.patient_id &&
      file.file_type === "summary" &&
      file.name?.includes(String(recordingFile.id).slice(0, 8))
  );
  if (existing) return existing;

  const patient = await ensurePatientDriveFolder(recordingFile.patient_id);
  const title = recordingTranscriptTitle(patient, recordingFile);
  const documentFile = await googleFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,createdTime",
    {
      method: "POST",
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        parents: [patient.drive_folder_id]
      })
    }
  );

  await googleFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentFile.id)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: recordingTranscriptText(patient, recordingFile)
            }
          }
        ]
      })
    }
  );

  const draft = await appendFileRecord({
    id: id(),
    patient_id: recordingFile.patient_id,
    drive_file_id: documentFile.id || "",
    drive_folder_id: patient.drive_folder_id || "",
    name: documentFile.name || title,
    file_type: "summary",
    url: documentFile.webViewLink || driveFileUrl(documentFile.id),
    created_at: documentFile.createdTime || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await createSystemTask(
    recordingFile.patient_id,
    "עריכת טיוטת תמלול",
    `נוצרה טיוטת תמלול עבור ההקלטה: ${recordingFile.name || "הקלטה"}`,
    isoDate(new Date())
  );
  return draft;
}

async function createPatientFolder(patientNameValue) {
  if (!state.config.googleDriveRootFolderId) return { id: "", path: "" };
  const folderName = `${patientNameValue} - ${isoDate(new Date())}`;
  const result = await googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [state.config.googleDriveRootFolderId]
    })
  });
  return { id: result.id || "", path: folderName };
}

function driveFileUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
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

async function uploadDriveFile(folderId, selectedFile, fileName) {
  const metadata = {
    name: fileName || selectedFile.name,
    parents: [folderId]
  };
  uploadCancelled = false;
  updateUploadProgress(0, selectedFile.size, `מעלה: ${metadata.name}`);
  const sessionResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink,createdTime",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": selectedFile.type || "application/octet-stream",
        "X-Upload-Content-Length": String(selectedFile.size)
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!sessionResponse.ok) {
    const text = await sessionResponse.text();
    clearUploadProgress();
    throw new Error(friendlyGoogleError(text, sessionResponse.status));
  }

  const sessionUrl = sessionResponse.headers.get("Location");
  if (!sessionUrl) {
    clearUploadProgress();
    throw new Error("Google לא החזיר כתובת להמשך ההעלאה.");
  }

  const chunkSize = 8 * 1024 * 1024;
  let offset = 0;
  let finalResult = null;

  try {
    if (selectedFile.size === 0) {
      const emptyResult = await resumableUploadRequest(sessionUrl, new Blob([]), "bytes */0", 0, 0, metadata.name);
      finalResult = JSON.parse(emptyResult.text || "{}");
    }

    while (offset < selectedFile.size) {
      if (uploadCancelled) throw new DOMException("ההעלאה בוטלה.", "AbortError");
      const chunkStart = offset;
      const endExclusive = Math.min(selectedFile.size, offset + chunkSize);
      const chunk = selectedFile.slice(offset, endExclusive);
      let completed = false;

      for (let attempt = 0; attempt < 4 && !completed; attempt += 1) {
        try {
          const result = await resumableUploadRequest(
            sessionUrl,
            chunk,
            `bytes ${chunkStart}-${endExclusive - 1}/${selectedFile.size}`,
            chunkStart,
            selectedFile.size,
            metadata.name
          );
          if ([200, 201].includes(result.status)) {
            finalResult = JSON.parse(result.text || "{}");
            offset = selectedFile.size;
            completed = true;
          } else if (result.status === 308) {
            const lastByte = Number((result.range || "").match(/bytes=0-(\d+)/)?.[1] || -1);
            offset = lastByte >= 0 ? lastByte + 1 : endExclusive;
            completed = true;
          } else {
            throw new Error(friendlyGoogleError(result.text, result.status));
          }
        } catch (error) {
          if (error?.name === "AbortError" || uploadCancelled) throw error;
          if (attempt === 3) throw error;
          await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** attempt));
          const probe = await resumableUploadRequest(
            sessionUrl,
            null,
            `bytes */${selectedFile.size}`,
            offset,
            selectedFile.size,
            metadata.name
          );
          if ([200, 201].includes(probe.status)) {
            finalResult = JSON.parse(probe.text || "{}");
            offset = selectedFile.size;
            completed = true;
          } else if (probe.status === 308) {
            const lastByte = Number((probe.range || "").match(/bytes=0-(\d+)/)?.[1] || -1);
            offset = lastByte >= 0 ? lastByte + 1 : 0;
            if (offset !== chunkStart) completed = true;
          }
        }
      }
    }
    updateUploadProgress(selectedFile.size, selectedFile.size, "ההעלאה הושלמה");
    return finalResult || {};
  } catch (error) {
    if (error?.name === "AbortError" || uploadCancelled) throw new Error("העלאת הקובץ בוטלה.");
    throw error;
  } finally {
    activeUploadRequest = null;
    window.setTimeout(clearUploadProgress, 800);
  }
}

function resumableUploadRequest(sessionUrl, body, contentRange, progressBase, total, fileName) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    activeUploadRequest = request;
    request.open("PUT", sessionUrl);
    request.setRequestHeader("Authorization", `Bearer ${state.accessToken}`);
    request.setRequestHeader("Content-Range", contentRange);
    if (body) request.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      updateUploadProgress(progressBase + event.loaded, total, `מעלה: ${fileName}`);
    });
    request.addEventListener("load", () => {
      resolve({
        status: request.status,
        text: request.responseText || "",
        range: request.getResponseHeader("Range") || ""
      });
    });
    request.addEventListener("error", () => reject(new Error("החיבור נקטע במהלך העלאת הקובץ.")));
    request.addEventListener("abort", () => reject(new DOMException("ההעלאה בוטלה.", "AbortError")));
    request.send(body || null);
  });
}

async function appendFileRecord(file) {
  const appendResult = await appendSheet("files", file);
  file._rowNumber = appendedRowNumber(appendResult);
  state.files = [file, ...state.files].sort((a, b) =>
    `${b.created_at}`.localeCompare(`${a.created_at}`)
  );
  return file;
}

async function uploadPatientFile(patientId, selectedFile, fileType = "document", customName = "") {
  if (!selectedFile) throw new Error("צריך לבחור קובץ להעלאה.");
  const patient = await ensurePatientDriveFolder(patientId);
  const now = new Date().toISOString();
  const result = await uploadDriveFile(
    patient.drive_folder_id,
    selectedFile,
    fileNameWithFallback(customName, selectedFile)
  );
  return appendFileRecord({
    id: id(),
    patient_id: patientId,
    drive_file_id: result.id || "",
    drive_folder_id: patient.drive_folder_id || "",
    name: result.name || selectedFile.name,
    file_type: fileType || driveFileTypeLabel(result.mimeType || selectedFile.type),
    url: result.webViewLink || driveFileUrl(result.id),
    created_at: result.createdTime || now,
    updated_at: now
  });
}

async function trashDriveFile(fileId) {
  if (!fileId) return;
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
    {
      method: "PATCH",
      body: JSON.stringify({ trashed: true })
    }
  );
}

async function updateDriveFileName(fileId, name) {
  if (!fileId || !name) return;
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name`,
    {
      method: "PATCH",
      body: JSON.stringify({ name })
    }
  );
}

async function moveDriveFile(fileId, oldFolderId, newFolderId) {
  if (!fileId || !newFolderId || oldFolderId === newFolderId) return;
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("addParents", newFolderId);
  if (oldFolderId) url.searchParams.set("removeParents", oldFolderId);
  url.searchParams.set("fields", "id,parents");
  await googleFetch(url.toString(), { method: "PATCH" });
}

async function untrashDriveFile(fileId) {
  if (!fileId) return;
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
    {
      method: "PATCH",
      body: JSON.stringify({ trashed: false })
    }
  );
}

function escapeDriveQueryValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findDriveChildFolder(parentId, name) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `name = '${escapeDriveQueryValue(name)}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "10");
  const result = await googleFetch(url.toString(), { headers: {} });
  return (result.files || []).find((file) => file.name === name) || null;
}

async function createDriveChildFolder(parentId, name) {
  return googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    })
  });
}

async function ensureDriveChildFolder(parentId, name) {
  const existing = await findDriveChildFolder(parentId, name);
  if (existing?.id) return existing;
  const created = await createDriveChildFolder(parentId, name);
  if (!created?.id) throw new Error(`יצירת תיקיית "${name}" באחסון נכשלה.`);
  return created;
}

async function ensureBusinessPeriodFolder(dateValue) {
  const rootId = state.config.googleDriveRootFolderId || "";
  if (!rootId) throw new Error("לא הוגדרה תיקיית אחסון ראשית במסך ההגדרות.");
  const period = BusinessCore.periodForDate(dateValue);
  if (!period) throw new Error("תאריך המסמך אינו תקין.");
  const businessFolder = await ensureDriveChildFolder(rootId, BusinessCore.BUSINESS_ROOT_FOLDER_NAME);
  const yearFolder = await ensureDriveChildFolder(businessFolder.id, period.year);
  const periodFolder = await ensureDriveChildFolder(yearFolder.id, period.label);
  return {
    id: periodFolder.id,
    path: `${BusinessCore.BUSINESS_ROOT_FOLDER_NAME}/${period.year}/${period.label}`
  };
}

function sortBusinessRecords(records) {
  return [...records].sort((a, b) =>
    `${b.document_date || ""} ${b.created_at || ""}`.localeCompare(`${a.document_date || ""} ${a.created_at || ""}`)
  );
}

async function saveBusinessRecord(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const existingId = form.dataset.id || "";
  const existing = existingId ? state.businessRecords.find((record) => record.id === existingId) : null;
  if (existingId && !existing) throw new Error("הרשומה לעריכה לא נמצאה.");

  const validated = BusinessCore.validateRecordInput({
    document_date: data.document_date || "",
    record_type: data.record_type || "",
    amount: data.amount || ""
  });
  if (validated.error) throw new Error(validated.error);

  if (existing) return updateBusinessRecord(existing, data, validated);
  return createBusinessRecord(form, data, validated);
}

async function createBusinessRecord(form, data, validated) {
  const selectedFile = form.elements.business_document?.files?.[0];
  if (!selectedFile) throw new Error("צריך לבחור קובץ מסמך להעלאה.");

  const folder = await ensureBusinessPeriodFolder(data.document_date);
  const uploaded = await uploadDriveFile(folder.id, selectedFile, selectedFile.name);
  if (!uploaded?.id) throw new Error("העלאת המסמך לאחסון נכשלה.");

  const now = new Date().toISOString();
  const record = {
    id: id(),
    document_date: data.document_date,
    record_type: data.record_type,
    amount: validated.amount,
    drive_file_id: uploaded.id,
    drive_folder_id: folder.id,
    file_name: uploaded.name || selectedFile.name,
    file_url: uploaded.webViewLink || driveFileUrl(uploaded.id),
    source: "manual",
    payment_id: "",
    created_at: now,
    updated_at: now
  };
  try {
    const result = await appendSheet("business_records", record);
    record._rowNumber = appendedRowNumber(result);
  } catch (persistError) {
    try {
      await trashDriveFile(uploaded.id);
    } catch {
      throw new Error(
        `שמירת הרשומה נכשלה וגם העברת הקובץ שהועלה לאשפה נכשלה. יש לבדוק את הקובץ "${record.file_name}" באחסון. שגיאה: ${persistError.message || persistError}`
      );
    }
    throw new Error(
      `שמירת הרשומה נכשלה. הקובץ שהועלה הועבר לאשפה ואפשר לנסות שוב. שגיאה: ${persistError.message || persistError}`
    );
  }
  state.businessRecords = sortBusinessRecords([record, ...state.businessRecords]);
  state.currentBusinessRecordId = "";
  const period = BusinessCore.periodForDate(record.document_date);
  if (period) state.businessView = { ...state.businessView, year: period.year, period: period.key };
  return record;
}

async function updateBusinessRecord(existing, data, validated) {
  if (!existing._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת הרשומה.");
  await assertSheetRowCurrent("business_records", existing._rowNumber, existing);

  const currentPeriod = BusinessCore.periodForDate(existing.document_date);
  const nextPeriod = BusinessCore.periodForDate(data.document_date);
  let folderId = existing.drive_folder_id || "";
  let movedFromFolderId = "";
  const periodChanged =
    !currentPeriod || currentPeriod.year !== nextPeriod.year || currentPeriod.key !== nextPeriod.key;
  if (existing.drive_file_id && periodChanged) {
    const folder = await ensureBusinessPeriodFolder(data.document_date);
    if (folder.id && folder.id !== folderId) {
      await moveDriveFile(existing.drive_file_id, folderId, folder.id);
      movedFromFolderId = folderId;
      folderId = folder.id;
    }
  }

  const updated = {
    ...existing,
    document_date: data.document_date,
    record_type: data.record_type,
    amount: validated.amount,
    drive_folder_id: folderId,
    updated_at: new Date().toISOString()
  };
  try {
    await updateSheetRow("business_records", existing._rowNumber, updated, existing);
  } catch (persistError) {
    if (movedFromFolderId) {
      try {
        await moveDriveFile(existing.drive_file_id, folderId, movedFromFolderId);
      } catch {
        throw new Error(
          `עדכון הרשומה נכשל והקובץ נשאר בתיקיית התקופה החדשה. יש לרענן נתונים ולנסות שוב. שגיאה: ${persistError.message || persistError}`
        );
      }
    }
    throw persistError;
  }
  state.businessRecords = sortBusinessRecords(
    state.businessRecords.map((item) => (item.id === updated.id ? updated : item))
  );
  state.currentBusinessRecordId = "";
  const period = BusinessCore.periodForDate(updated.document_date);
  if (period) state.businessView = { ...state.businessView, year: period.year, period: period.key };
  return updated;
}

async function deleteBusinessRecordEntry(recordId) {
  const record = state.businessRecords.find((item) => item.id === recordId);
  if (!record) throw new Error("הרשומה לא נמצאה.");
  if (!record._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת הרשומה.");

  await assertSheetRowCurrent("business_records", record._rowNumber, record);
  if (record.drive_file_id) await trashDriveFile(record.drive_file_id);
  try {
    await clearSheetRow("business_records", record._rowNumber, record);
  } catch (clearError) {
    if (record.drive_file_id) {
      try {
        await untrashDriveFile(record.drive_file_id);
      } catch {
        throw new Error(
          `מחיקת הרשומה נכשלה והקובץ נשאר באשפה של האחסון. אפשר לשחזר אותו ידנית מהאשפה. שגיאה: ${clearError.message || clearError}`
        );
      }
    }
    throw clearError;
  }
  state.businessRecords = state.businessRecords.filter((item) => item.id !== recordId);
  if (state.currentBusinessRecordId === recordId) state.currentBusinessRecordId = "";
}

function paymentIncomeRecord(paymentId) {
  if (!paymentId) return null;
  return (
    state.businessRecords.find(
      (record) => record.source === "payment" && record.payment_id === paymentId
    ) || null
  );
}

async function copyDriveFileToFolder(fileId, folderId, name) {
  const copied = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/copy?fields=id,name,webViewLink`,
    { method: "POST", body: JSON.stringify({ name, parents: [folderId] }) }
  );
  if (!copied?.id) throw new Error("יצירת עותק הקבלה בתיקיית ניהול העסק נכשלה.");
  return copied;
}

async function syncPaymentIncomeRecord(payment, receiptReplaced = false) {
  const existingRecord = paymentIncomeRecord(payment.id);
  if (!existingRecord && !payment.receipt_file_id) return null;

  const validated = BusinessCore.validateRecordInput({
    document_date: payment.paid_at,
    record_type: "income",
    amount: payment.amount
  });
  if (validated.error) throw new Error(validated.error);

  if (!existingRecord) return createPaymentIncomeRecord(payment, validated);
  return updatePaymentIncomeRecord(existingRecord, payment, validated, receiptReplaced);
}

function paymentReceiptCopyName(payment) {
  const receiptFile = state.files.find((item) => item.drive_file_id === payment.receipt_file_id);
  return receiptFile?.name || `קבלה ${payment.paid_at}`;
}

async function createPaymentIncomeRecord(payment, validated) {
  const folder = await ensureBusinessPeriodFolder(payment.paid_at);
  const copied = await copyDriveFileToFolder(
    payment.receipt_file_id,
    folder.id,
    paymentReceiptCopyName(payment)
  );

  const now = new Date().toISOString();
  const record = {
    id: id(),
    document_date: payment.paid_at,
    record_type: "income",
    amount: validated.amount,
    drive_file_id: copied.id,
    drive_folder_id: folder.id,
    file_name: copied.name || paymentReceiptCopyName(payment),
    file_url: copied.webViewLink || driveFileUrl(copied.id),
    source: "payment",
    payment_id: payment.id,
    created_at: now,
    updated_at: now
  };
  try {
    const result = await appendSheet("business_records", record);
    record._rowNumber = appendedRowNumber(result);
  } catch (persistError) {
    try {
      await trashDriveFile(copied.id);
    } catch {
      throw new Error(
        `שמירת רשומת ההכנסה נכשלה וגם העברת עותק הקבלה לאשפה נכשלה. יש לבדוק את הקובץ "${record.file_name}" באחסון. שגיאה: ${persistError.message || persistError}`
      );
    }
    throw new Error(
      `שמירת רשומת ההכנסה נכשלה. עותק הקבלה הועבר לאשפה ואפשר לנסות שוב. שגיאה: ${persistError.message || persistError}`
    );
  }
  state.businessRecords = sortBusinessRecords([record, ...state.businessRecords]);
  return record;
}

async function updatePaymentIncomeRecord(record, payment, validated, receiptReplaced) {
  const replacingCopy = receiptReplaced && Boolean(payment.receipt_file_id);
  const unchanged =
    !replacingCopy && record.document_date === payment.paid_at && record.amount === validated.amount;
  if (unchanged) return record;

  if (!record._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון רשומת ההכנסה המקושרת.");
  await assertSheetRowCurrent("business_records", record._rowNumber, record);

  const currentPeriod = BusinessCore.periodForDate(record.document_date);
  const nextPeriod = BusinessCore.periodForDate(payment.paid_at);
  const periodChanged =
    !currentPeriod || currentPeriod.year !== nextPeriod.year || currentPeriod.key !== nextPeriod.key;

  let folderId = record.drive_folder_id || "";
  let movedFromFolderId = "";
  let newCopy = null;
  const previousCopyId = record.drive_file_id || "";

  if (replacingCopy) {
    const folder = periodChanged || !folderId ? await ensureBusinessPeriodFolder(payment.paid_at) : { id: folderId };
    folderId = folder.id;
    newCopy = await copyDriveFileToFolder(payment.receipt_file_id, folderId, paymentReceiptCopyName(payment));
  } else if (record.drive_file_id && periodChanged) {
    const folder = await ensureBusinessPeriodFolder(payment.paid_at);
    if (folder.id && folder.id !== folderId) {
      await moveDriveFile(record.drive_file_id, folderId, folder.id);
      movedFromFolderId = folderId;
      folderId = folder.id;
    }
  }

  const updated = {
    ...record,
    document_date: payment.paid_at,
    amount: validated.amount,
    drive_file_id: newCopy ? newCopy.id : record.drive_file_id,
    drive_folder_id: folderId,
    file_name: newCopy ? newCopy.name || paymentReceiptCopyName(payment) : record.file_name,
    file_url: newCopy ? newCopy.webViewLink || driveFileUrl(newCopy.id) : record.file_url,
    updated_at: new Date().toISOString()
  };
  try {
    await updateSheetRow("business_records", record._rowNumber, updated, record);
  } catch (persistError) {
    if (newCopy) {
      try {
        await trashDriveFile(newCopy.id);
      } catch {
        throw new Error(
          `עדכון רשומת ההכנסה נכשל וגם העברת עותק הקבלה החדש לאשפה נכשלה. יש לבדוק את הקובץ "${updated.file_name}" באחסון. שגיאה: ${persistError.message || persistError}`
        );
      }
    }
    if (movedFromFolderId) {
      try {
        await moveDriveFile(record.drive_file_id, folderId, movedFromFolderId);
      } catch {
        throw new Error(
          `עדכון רשומת ההכנסה נכשל ועותק הקבלה נשאר בתיקיית התקופה החדשה. יש לרענן נתונים ולנסות שוב. שגיאה: ${persistError.message || persistError}`
        );
      }
    }
    throw persistError;
  }
  state.businessRecords = sortBusinessRecords(
    state.businessRecords.map((item) => (item.id === updated.id ? updated : item))
  );
  if (newCopy && previousCopyId) {
    try {
      await trashDriveFile(previousCopyId);
    } catch (trashError) {
      throw new Error(
        `רשומת ההכנסה עודכנה, אך עותק הקבלה הישן "${record.file_name}" נשאר בתיקיית ניהול העסק ויש למחוק אותו ידנית. שגיאה: ${trashError.message || trashError}`
      );
    }
  }
  return updated;
}

async function updateLinkedFileReferences(oldDriveFileId, newDriveFileId = "") {
  if (!oldDriveFileId) return;
  const now = new Date().toISOString();
  const linkedPayments = state.payments.filter((payment) => payment.receipt_file_id === oldDriveFileId);
  for (const payment of linkedPayments) {
    if (!payment._rowNumber) continue;
    const updated = {
      ...payment,
      receipt_file_id: newDriveFileId,
      receipt_status: newDriveFileId ? payment.receipt_status || "issued" : "needed",
      updated_at: now
    };
    await updateSheetRow("payments", payment._rowNumber, updated, payment);
    // עדכון במקום שומר על אותה רפרנס שמחזיקים קוראים במקביל (מחיקת תשלום/קבלה), כולל _loadedVersion עדכני.
    Object.assign(payment, updated);
  }

  const linkedSessions = state.sessions.filter((session) => session.document_file_id === oldDriveFileId);
  for (const session of linkedSessions) {
    if (!session._rowNumber) continue;
    const updated = {
      ...session,
      document_file_id: newDriveFileId,
      updated_at: now
    };
    await updateSheetRow("sessions", session._rowNumber, updated, session);
    Object.assign(session, updated);
  }
}

async function deleteFileRecord(fileId) {
  const file = state.files.find((item) => item.id === fileId);
  if (!file) throw new Error("הקובץ לא נמצא.");
  if (!file._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת הקובץ.");

  await assertSheetRowCurrent("files", file._rowNumber, file);
  if (file.drive_file_id) {
    await updateLinkedFileReferences(file.drive_file_id, "");
    await trashDriveFile(file.drive_file_id);
  }
  await clearSheetRow("files", file._rowNumber, file);
  state.files = state.files.filter((item) => item.id !== fileId);
  if (state.currentFileId === fileId) state.currentFileId = "";
}

async function ensurePatientDriveFolder(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error("המטופל לא נמצא.");
  if (patient.drive_folder_id) return patient;
  if (!patient._rowNumber) throw new Error("צריך לרענן נתונים לפני יצירת תיקייה למטופל הזה.");

  await assertSheetRowCurrent("patients", patient._rowNumber, patient);
  const folder = await createPatientFolder(patient.child_name);
  if (!folder.id) throw new Error("לא הוגדרה תיקיית אחסון ראשית במסך ההגדרות.");

  const updated = {
    ...patient,
    drive_folder_id: folder.id,
    drive_folder_path: folder.path,
    updated_at: new Date().toISOString()
  };

  await updateSheetRow("patients", patient._rowNumber, updated);
  state.patients = state.patients.map((item) => (item.id === patientId ? updated : item));
  return updated;
}

async function listDriveFolderFiles(folderId) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`
  );
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,createdTime)");
  url.searchParams.set("pageSize", "100");
  const result = await googleFetch(url.toString(), { headers: {} });
  return result.files || [];
}

async function loadDriveTemplates() {
  if (!state.config.googleTemplatesFolderId) return [];
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `'${state.config.googleTemplatesFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`
  );
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink,createdTime)");
  url.searchParams.set("pageSize", "50");
  const result = await googleFetch(url.toString(), { headers: {} });
  return result.files || [];
}

async function findSettingsFile() {
  if (!state.config.googleDriveRootFolderId) return null;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set(
    "q",
    `'${state.config.googleDriveRootFolderId}' in parents and trashed = false and name='${SETTINGS_FILE_NAME}'`
  );
  url.searchParams.set("fields", "files(id,name,createdTime,modifiedTime)");
  url.searchParams.set("pageSize", "1");
  const result = await googleFetch(url.toString(), { headers: {} });
  return result.files?.[0] || null;
}

async function loadRemoteSettings() {
  const settingsFile = await findSettingsFile();
  if (!settingsFile?.id) return;
  const remoteConfig = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(settingsFile.id)}?alt=media`,
    { headers: {} }
  );
  if (!remoteConfig || typeof remoteConfig !== "object") return;
  saveConfig({
    ...state.config,
    ...remoteConfig,
    allowedUserEmails: savedListText(
      remoteConfig.allowedUserEmails,
      state.config.allowedUserEmails
    ),
    sessionTypes: listText(remoteConfig.sessionTypes, state.config.sessionTypes, DEFAULT_SESSION_TYPES),
    sessionLocations: listText(
      remoteConfig.sessionLocations,
      state.config.sessionLocations,
      DEFAULT_SESSION_LOCATIONS
    )
  });
}

async function saveRemoteSettings() {
  if (!state.accessToken || !state.config.googleDriveRootFolderId) return;
  const payload = JSON.stringify(
    {
      googleClientId: state.config.googleClientId || "",
      googleDriveRootFolderId: state.config.googleDriveRootFolderId || "",
      googleTemplatesFolderId: state.config.googleTemplatesFolderId || "",
      googleCalendarId: state.config.googleCalendarId || "primary",
      googleSpreadsheetId: state.config.googleSpreadsheetId || "",
      allowedUserEmails: state.config.allowedUserEmails || "",
      sessionTypes: state.config.sessionTypes || "",
      sessionLocations: state.config.sessionLocations || "",
      updated_at: new Date().toISOString()
    },
    null,
    2
  );
  const existing = await findSettingsFile();
  if (existing?.id) {
    await googleFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media`,
      {
        method: "PATCH",
        body: payload
      }
    );
    return;
  }

  const boundary = `clinic-settings-${Date.now()}`;
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
        name: SETTINGS_FILE_NAME,
        mimeType: "application/json",
        parents: [state.config.googleDriveRootFolderId]
      })}\r\n`,
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${payload}\r\n`,
      `--${boundary}--`
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.accessToken}`
    },
    body
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(friendlyGoogleError(text, response.status));
    }
  });
}

async function syncPatientDriveFiles(patientId) {
  const patient = await ensurePatientDriveFolder(patientId);
  const driveFiles = await listDriveFolderFiles(patient.drive_folder_id);
  const existingIds = new Set(
    state.files
      .filter((file) => file.patient_id === patientId)
      .map((file) => file.drive_file_id)
      .filter(Boolean)
  );
  const now = new Date().toISOString();
  const newFiles = driveFiles
    .filter((file) => !existingIds.has(file.id))
    .map((file) => ({
      id: id(),
      patient_id: patientId,
      drive_file_id: file.id,
      drive_folder_id: patient.drive_folder_id,
      name: file.name || "קובץ ללא שם",
      file_type: driveFileTypeLabel(file.mimeType),
      url: file.webViewLink || driveFileUrl(file.id),
      created_at: file.createdTime || now,
      updated_at: now
    }));

  for (const file of newFiles) {
    const appendResult = await appendSheet("files", file);
    file._rowNumber = appendedRowNumber(appendResult);
  }

  state.files = [...newFiles, ...state.files].sort((a, b) =>
    `${b.created_at}`.localeCompare(`${a.created_at}`)
  );
  return newFiles.length;
}

async function loadData() {
  if (!state.accessToken) return;
  if (!state.authChecked) await loadGoogleUser();
  if (!isAuthorizedGoogleUser()) throw new Error("החשבון המחובר לא מורשה להשתמש במערכת הזו.");
  await loadRemoteSettings().catch(() => {});
  if (!isAuthorizedGoogleUser()) throw new Error("החשבון המחובר לא מורשה להשתמש במערכת הזו.");
  const removedPublicPermissions = await repairSharingSecurity();
  if (removedPublicPermissions) {
    state.message = `הוסרו ${removedPublicPermissions} הרשאות שיתוף ציבוריות ממשאבי הקליניקה.`;
  }
  if (!state.config.googleSpreadsheetId) return;
  await ensureSpreadsheetSchema();
  const [patients, sessions, payments, tasks, files, contacts, goals, goalUpdates, questionnaireTemplates, questionnaireAssignments, questionnaireResponses, clinicalReports, businessRecords, sessionCharges, paymentAllocations, scheduleExceptions, auditLog, templates] = await Promise.all([
    readSheet("patients"),
    readSheet("sessions"),
    readSheet("payments"),
    readSheet("tasks"),
    readSheet("files"),
    readSheet("contacts"),
    readSheet("goals"),
    readSheet("goal_updates"),
    readSheet("questionnaire_templates"),
    readSheet("questionnaire_assignments"),
    readSheet("questionnaire_responses"),
    readSheet("clinical_reports"),
    readSheet("business_records"),
    readSheet("session_charges"),
    readSheet("payment_allocations"),
    readSheet("schedule_exceptions"),
    readSheet("audit_log"),
    loadDriveTemplates().catch(() => [])
  ]);
  state.patients = patients.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || "", "he"));
  state.sessions = sessions.sort((a, b) => `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`));
  state.payments = payments.sort((a, b) => `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`));
  state.tasks = tasks.sort((a, b) => `${a.due_date || "9999-99-99"} ${a.created_at}`.localeCompare(`${b.due_date || "9999-99-99"} ${b.created_at}`));
  state.files = files.sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
  state.contacts = contacts.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  state.goals = goals.sort((a, b) => `${b.updated_at || ""}`.localeCompare(`${a.updated_at || ""}`));
  state.goalUpdates = goalUpdates.sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
  state.questionnaireTemplates = questionnaireTemplates;
  state.questionnaireAssignments = questionnaireAssignments.sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
  state.questionnaireResponses = questionnaireResponses.sort((a, b) => `${b.submitted_at || ""}`.localeCompare(`${a.submitted_at || ""}`));
  state.clinicalReports = clinicalReports.sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
  state.businessRecords = businessRecords.sort((a, b) =>
    `${b.document_date || ""} ${b.created_at || ""}`.localeCompare(`${a.document_date || ""} ${a.created_at || ""}`)
  );
  state.sessionCharges = sessionCharges.sort((a, b) =>
    `${b.session_date || ""} ${b.created_at || ""}`.localeCompare(`${a.session_date || ""} ${a.created_at || ""}`)
  );
  state.paymentAllocations = paymentAllocations.sort((a, b) =>
    `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`)
  );
  state.scheduleExceptions = scheduleExceptions.sort((a, b) =>
    `${b.start_date || ""} ${b.created_at || ""}`.localeCompare(`${a.start_date || ""} ${a.created_at || ""}`)
  );
  state.auditLog = auditLog.sort((a, b) => `${b.created_at || ""}`.localeCompare(`${a.created_at || ""}`));
  state.lastUndoActionId = state.auditLog.find(
    (entry) => entry.undoable === "yes" && !entry.undone_at && auditMutations(entry).length
  )?.id || "";
  state.templates = templates.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  await seedQuestionnaireTemplates();
  await migrateLegacyGoals();
  state.lastRefreshAt = new Date().toISOString();
  saveSyncState();
  queueCalendarPrivacyMigration();
  processSyncQueue().catch(() => {});
}

async function savePatient(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const existingId = form.dataset.id || "";
  const existing = existingId ? state.patients.find((patient) => patient.id === existingId) : null;
  if (!data.child_name) throw new Error("שם המטופל הוא שדה חובה.");
  if (existing?._rowNumber) await assertSheetRowCurrent("patients", existing._rowNumber, existing);

  const now = new Date().toISOString();
  const folder = existing?.drive_folder_id
    ? { id: existing.drive_folder_id || "", path: existing.drive_folder_path || "" }
    : await createPatientFolder(data.child_name);
  if (!folder.id) throw new Error("לא הוגדרה תיקיית אחסון ראשית במסך ההגדרות.");

  const patient = {
    ...(existing || {}),
    id: existing?.id || id(),
    child_name: data.child_name,
    address: existing?.address || "",
    school_name: data.school_name || "",
    treatment_type: data.treatment_type || "",
    fixed_price: data.fixed_price || "",
    fixed_day: data.fixed_day || "",
    fixed_time: data.fixed_time || "",
    treatment_goals: existing?.treatment_goals || "",
    sensitive_notes: existing?.sensitive_notes || "",
    general_notes: data.general_notes || "",
    status: existing?.status || "active",
    default_payment_method: existing?.default_payment_method || "bank_transfer",
    payment_status: existing?.payment_status || "unpaid",
    receipt_status: existing?.receipt_status || "needed",
    drive_folder_id: folder.id,
    drive_folder_path: folder.path,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  if (existing) {
    if (!existing._rowNumber) throw new Error("לא ניתן לעדכן את המטופל לפני רענון הנתונים.");
    await updateSheetRow("patients", existing._rowNumber, patient);
    state.patients = state.patients.map((item) => (item.id === patient.id ? patient : item));
  } else {
    const appendResult = await appendSheet("patients", patient);
    patient._rowNumber = appendedRowNumber(appendResult);
    state.patients = [patient, ...state.patients];
  }

  state.patients = state.patients.sort((a, b) =>
    (a.child_name || "").localeCompare(b.child_name || "", "he")
  );

  return {
    ...patient,
    folderCreated: !existing?.drive_folder_id
  };
}

async function togglePatientArchive(patientId, shouldArchive) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error("המטופל לא נמצא.");
  if (!patient._rowNumber) throw new Error("לא ניתן לעדכן את המטופל לפני רענון הנתונים.");

  const updated = {
    ...patient,
    status: shouldArchive ? "archived" : "active",
    updated_at: new Date().toISOString()
  };

  await updateSheetRow("patients", patient._rowNumber, updated);
  state.patients = state.patients.map((item) => (item.id === patientId ? updated : item));
}

async function saveContact(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const existingId = form.dataset.id || "";
  const existing = existingId ? state.contacts.find((contact) => contact.id === existingId) : null;
  if (!patientId || !state.patients.some((patient) => patient.id === patientId)) {
    throw new Error("לא נמצא מטופל לשיוך איש הקשר.");
  }
  if (!String(data.name || "").trim()) throw new Error("שם איש הקשר הוא שדה חובה.");
  if (existingId && !existing) throw new Error("איש הקשר לעריכה לא נמצא.");
  if (existing && !existing._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת איש קשר.");
  if (existing) await assertSheetRowCurrent("contacts", existing._rowNumber, existing);

  const now = new Date().toISOString();
  const contact = {
    ...(existing || {}),
    id: existing?.id || id(),
    patient_id: patientId,
    contact_type: data.contact_type === "professional" ? "professional" : "parent",
    name: String(data.name || "").trim(),
    relationship: String(data.relationship || "").trim(),
    phone: String(data.phone || "").trim(),
    email: String(data.email || "").trim(),
    organization: String(data.organization || "").trim(),
    notes: String(data.notes || "").trim(),
    created_at: existing?.created_at || now,
    updated_at: now
  };

  if (existing) {
    await updateSheetRow("contacts", existing._rowNumber, contact, existing);
    contact._rowNumber = existing._rowNumber;
    state.contacts = state.contacts.map((item) => (item.id === contact.id ? contact : item));
  } else {
    const result = await appendSheet("contacts", contact);
    contact._rowNumber = appendedRowNumber(result);
    state.contacts = [...state.contacts, contact];
  }
  state.contacts = state.contacts.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  state.currentContactId = "";
  return contact;
}

async function deleteContactRecord(contactId) {
  const contact = state.contacts.find((item) => item.id === contactId);
  if (!contact) throw new Error("איש הקשר לא נמצא.");
  if (!contact._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת איש קשר.");
  await clearSheetRow("contacts", contact._rowNumber, contact);
  state.contacts = state.contacts.filter((item) => item.id !== contactId);
  if (state.currentContactId === contactId) state.currentContactId = "";
}

async function saveGoal(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const existing = form.dataset.id ? state.goals.find((goal) => goal.id === form.dataset.id) : null;
  if (!patientId || !String(data.title || "").trim()) throw new Error("כותרת המטרה היא שדה חובה.");
  const progress = Math.max(0, Math.min(100, Number(data.progress) || 0));
  const now = new Date().toISOString();
  const goal = {
    ...(existing || {}),
    id: existing?.id || id(), patient_id: patientId, title: String(data.title).trim(),
    description: data.description || "", status: progress >= 100 ? "achieved" : data.status || "active",
    progress: String(progress), target_date: data.target_date || "", note: data.note || "",
    legacy_source: existing?.legacy_source || "", created_at: existing?.created_at || now, updated_at: now
  };
  if (existing) {
    if (!existing._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת המטרה.");
    await updateSheetRow("goals", existing._rowNumber, goal, existing);
    goal._rowNumber = existing._rowNumber;
    state.goals = state.goals.map((item) => item.id === goal.id ? goal : item);
  } else {
    const result = await appendSheet("goals", goal);
    goal._rowNumber = appendedRowNumber(result);
    state.goals = [goal, ...state.goals];
  }
  state.currentGoalId = "";
  return goal;
}

async function saveQuestionnaireTemplate(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = form.dataset.id ? state.questionnaireTemplates.find((template) => template.id === form.dataset.id) : null;
  const questions = String(data.questions_text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((title) => ({ title, type: "paragraph", required: false }));
  if (!String(data.name || "").trim() || !questions.length) throw new Error("צריך להגדיר שם ולפחות שאלה אחת.");
  const now = new Date().toISOString();
  const template = {
    ...(existing || {}), id: existing?.id || id(), name: String(data.name).trim(), audience: data.audience || "parent",
    questions_json: JSON.stringify(questions), active: existing?.active || "yes", created_at: existing?.created_at || now, updated_at: now
  };
  if (existing) {
    if (!existing._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת התבנית.");
    await updateSheetRow("questionnaire_templates", existing._rowNumber, template, existing);
    template._rowNumber = existing._rowNumber;
    state.questionnaireTemplates = state.questionnaireTemplates.map((item) => item.id === template.id ? template : item);
  } else {
    const result = await appendSheet("questionnaire_templates", template);
    template._rowNumber = appendedRowNumber(result);
    state.questionnaireTemplates.push(template);
  }
  return template;
}

async function moveDriveFileToFolder(fileId, folderId) {
  const file = await googleFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents`, { headers: {} });
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("addParents", folderId);
  if (file.parents?.length) url.searchParams.set("removeParents", file.parents.join(","));
  url.searchParams.set("fields", "id,parents");
  await googleFetch(url.toString(), { method: "PATCH", body: JSON.stringify({}) });
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

async function createQuestionnaireAssignment(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const contact = state.contacts.find((item) => item.id === data.contact_id && item.patient_id === patientId);
  const template = state.questionnaireTemplates.find((item) => item.id === data.template_id);
  if (!contact || !template) throw new Error("צריך לבחור נמען ותבנית שאלון.");
  const patient = await ensurePatientDriveFolder(patientId);
  const created = await googleFetch("https://forms.googleapis.com/v1/forms?unpublished=true", {
    method: "POST", body: JSON.stringify({ info: { title: template.name, documentTitle: `${template.name} - ${isoDate(new Date())}` } })
  });
  const questions = safeJson(template.questions_json, []);
  await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(created.formId)}:batchUpdate`, {
    method: "POST", body: JSON.stringify({ requests: questions.map(formQuestionRequest) })
  });
  await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(created.formId)}:setPublishSettings`, {
    method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } } })
  });
  await moveDriveFileToFolder(created.formId, patient.drive_folder_id);
  const published = await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(created.formId)}`, { headers: {} });
  const now = new Date().toISOString();
  const assignment = {
    id: id(), patient_id: patientId, contact_id: contact.id, template_id: template.id, form_id: created.formId,
    responder_url: published.responderUri || `https://docs.google.com/forms/d/${created.formId}/viewform`, status: "draft",
    sent_at: "", due_date: data.due_date || "", responded_at: "", last_response_id: "", created_at: now, updated_at: now
  };
  const result = await appendSheet("questionnaire_assignments", assignment);
  assignment._rowNumber = appendedRowNumber(result);
  state.questionnaireAssignments = [assignment, ...state.questionnaireAssignments];
  return assignment;
}

function questionnaireMessage(assignment) {
  const template = state.questionnaireTemplates.find((item) => item.id === assignment.template_id);
  return `שלום, מצורף ${template?.name || "שאלון"} לקראת המשך העבודה. ניתן למלא בקישור: ${assignment.responder_url}`;
}

async function markQuestionnaireSent(assignment) {
  if (!assignment._rowNumber || assignment.status !== "draft") return assignment;
  const updated = { ...assignment, status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await updateSheetRow("questionnaire_assignments", assignment._rowNumber, updated, assignment);
  state.questionnaireAssignments = state.questionnaireAssignments.map((item) => item.id === assignment.id ? updated : item);
  return updated;
}

async function syncQuestionnaireAssignment(assignment) {
  if (!assignment.form_id || assignment.status === "completed") return false;
  const responsesResult = await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(assignment.form_id)}/responses`, { headers: {} });
  const responses = responsesResult.responses || [];
  const response = responses.sort((a, b) => `${b.lastSubmittedTime || b.createTime || ""}`.localeCompare(`${a.lastSubmittedTime || a.createTime || ""}`))[0];
  if (!response || state.questionnaireResponses.some((item) => item.response_id === response.responseId)) return false;
  const formDefinition = await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(assignment.form_id)}`, { headers: {} });
  const titleById = Object.fromEntries((formDefinition.items || []).map((item) => [item.questionItem?.question?.questionId || item.itemId, item.title || "שאלה"]));
  const answers = Object.entries(response.answers || {}).map(([itemId, answer]) => ({
    question: titleById[itemId] || "שאלה",
    answer: (answer.textAnswers?.answers || []).map((item) => item.value).join(", ")
  }));
  const now = new Date().toISOString();
  const record = {
    id: id(), assignment_id: assignment.id, patient_id: assignment.patient_id, contact_id: assignment.contact_id,
    response_id: response.responseId, submitted_at: response.lastSubmittedTime || response.createTime || now,
    answers_json: JSON.stringify(answers), reviewed_at: "", created_at: now, updated_at: now
  };
  const result = await appendSheet("questionnaire_responses", record);
  record._rowNumber = appendedRowNumber(result);
  state.questionnaireResponses = [record, ...state.questionnaireResponses];
  const updated = { ...assignment, status: "completed", responded_at: record.submitted_at, last_response_id: response.responseId, updated_at: now };
  await updateSheetRow("questionnaire_assignments", assignment._rowNumber, updated, assignment);
  state.questionnaireAssignments = state.questionnaireAssignments.map((item) => item.id === assignment.id ? updated : item);
  await googleFetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(assignment.form_id)}:setPublishSettings`, {
    method: "POST", body: JSON.stringify({ publishSettings: { publishState: { isPublished: true, isAcceptingResponses: false } } })
  });
  return true;
}

async function syncQuestionnaires(patientId) {
  let imported = 0;
  const pending = state.questionnaireAssignments.filter((assignment) => assignment.patient_id === patientId && !["completed", "closed"].includes(assignment.status));
  for (const assignment of pending) if (await syncQuestionnaireAssignment(assignment)) imported += 1;
  return imported;
}

async function createClinicalReport(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const patient = await ensurePatientDriveFolder(patientId);
  const reportType = data.report_type || "progress";
  const content = String(data.content || "").trim() || clinicalReportDraft(patientId, reportType, data.period_start, data.period_end);
  const now = new Date().toISOString();
  const title = String(data.title || "").trim() || `${reportTypeLabel(reportType)} - ${patient.child_name || "מטופל"} - ${isoDate(new Date())}`;
  const documentFile = await googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,createdTime", {
    method: "POST", body: JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document", parents: [patient.drive_folder_id] })
  });
  await googleFetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentFile.id)}:batchUpdate`, {
    method: "POST", body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: content } }] })
  });
  await appendFileRecord({
    id: id(), patient_id: patientId, drive_file_id: documentFile.id, drive_folder_id: patient.drive_folder_id,
    name: title, file_type: "document", url: documentFile.webViewLink || driveFileUrl(documentFile.id),
    created_at: documentFile.createdTime || now, updated_at: now
  });
  const pdfBlob = await googleFetchBlob(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentFile.id)}/export?mimeType=${encodeURIComponent("application/pdf")}`);
  const pdfFile = new File([pdfBlob], `${title}.pdf`, { type: "application/pdf" });
  const uploadedPdf = await uploadDriveFile(patient.drive_folder_id, pdfFile, pdfFile.name);
  await appendFileRecord({
    id: id(), patient_id: patientId, drive_file_id: uploadedPdf.id, drive_folder_id: patient.drive_folder_id,
    name: uploadedPdf.name || pdfFile.name, file_type: "document", url: uploadedPdf.webViewLink || driveFileUrl(uploadedPdf.id),
    created_at: uploadedPdf.createdTime || now, updated_at: now
  });
  const report = {
    id: id(), patient_id: patientId, report_type: reportType, title, period_start: data.period_start || "", period_end: data.period_end || "",
    content, document_file_id: documentFile.id, pdf_file_id: uploadedPdf.id, created_at: now, updated_at: now
  };
  const result = await appendSheet("clinical_reports", report);
  report._rowNumber = appendedRowNumber(result);
  state.clinicalReports = [report, ...state.clinicalReports];
  return report;
}

async function saveSessionGoalUpdates(form, session) {
  const patientGoals = state.goals.filter((goal) => goal.patient_id === session.patient_id && ["planned", "active"].includes(goal.status));
  for (const goal of patientGoals) {
    const progressField = form.elements[`goal_progress_${goal.id}`];
    const noteField = form.elements[`goal_note_${goal.id}`];
    if (!progressField) continue;
    const progress = Math.max(0, Math.min(100, Number(progressField.value) || 0));
    const note = String(noteField?.value || "").trim();
    if (!note && progress === Number(goal.progress || 0)) continue;
    const now = new Date().toISOString();
    const update = {
      id: id(), goal_id: goal.id, patient_id: goal.patient_id, session_id: session.id,
      progress: String(progress), status: progress >= 100 ? "achieved" : "active", note,
      created_at: now, updated_at: now
    };
    const result = await appendSheet("goal_updates", update);
    update._rowNumber = appendedRowNumber(result);
    state.goalUpdates = [update, ...state.goalUpdates];
    if (goal._rowNumber) {
      const updatedGoal = { ...goal, progress: String(progress), status: update.status, updated_at: now };
      await updateSheetRow("goals", goal._rowNumber, updatedGoal, goal);
      state.goals = state.goals.map((item) => item.id === goal.id ? updatedGoal : item);
    }
  }
}

async function saveSession(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const existingId = form.dataset.id || "";
  const existing = existingId ? state.sessions.find((session) => session.id === existingId) : null;
  lastCalendarSyncError = "";
  lastDocumentSyncError = "";

  if (!patientId) throw new Error("לא נמצא מטופל לשמירת המפגש.");
  if (!data.session_date) throw new Error("תאריך מפגש הוא שדה חובה.");
  if (existingId && !existing) throw new Error("המפגש לעריכה לא נמצא.");
  if (existing && !existing._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת מפגש קיים.");
  if (existing) await assertSheetRowCurrent("sessions", existing._rowNumber, existing);

  const chargeNeeded = Boolean(String(data.summary || "").trim()) && !(existing && sessionChargeForSession(existing.id));
  let chargePriceAgorot = null;
  if (chargeNeeded) {
    const patient = state.patients.find((item) => item.id === patientId);
    chargePriceAgorot = PaymentsCore.parseAmountToAgorot(patient?.fixed_price || "");
    if (chargePriceAgorot === null) {
      throw new Error("לא הוגדר מחיר טיפול קבוע תקין למטופל. יש להגדיר מחיר קבוע בכרטיס המטופל לפני שמירת תיעוד המפגש.");
    }
  }

  const now = new Date().toISOString();
  const session = {
    ...(existing || {}),
    id: existing?.id || id(),
    patient_id: patientId,
    session_date: data.session_date,
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    location: data.location || "",
    session_type: data.session_type || "",
    summary: data.summary || "",
    sensitive_notes: data.sensitive_notes || "",
    calendar_event_id: existing?.calendar_event_id || "",
    document_file_id: existing?.document_file_id || "",
    created_at: existing?.created_at || now,
    updated_at: now
  };

  try {
    session.calendar_event_id = existing
      ? await updateCalendarEvent(session)
      : await createCalendarEvent(session);
  } catch {
    queueSyncWork("calendar_upsert", session.id, {});
    lastCalendarSyncError = "היומן עדיין לא הסתנכרן; המערכת תנסה שוב אוטומטית.";
  }

  if (existing) {
    await updateSheetRow("sessions", existing._rowNumber, session);
    session._rowNumber = existing._rowNumber;
    state.sessions = state.sessions.map((item) => (item.id === session.id ? session : item));
  } else {
    const appendResult = await appendSheet("sessions", session);
    session._rowNumber = appendedRowNumber(appendResult);
    state.sessions = [session, ...state.sessions];
  }

  if (chargeNeeded && !sessionChargeForSession(session.id)) {
    const charge = {
      id: id(),
      session_id: session.id,
      patient_id: session.patient_id,
      session_date: session.session_date,
      amount: PaymentsCore.agorotToAmountText(chargePriceAgorot),
      created_at: now,
      updated_at: now
    };
    const chargeResult = await appendSheet("session_charges", charge);
    charge._rowNumber = appendedRowNumber(chargeResult);
    state.sessionCharges = [charge, ...state.sessionCharges];
  }

  try {
    const documentFileId = await updateSessionDocument(patientId, session);
    if (documentFileId && documentFileId !== session.document_file_id) {
      session.document_file_id = documentFileId;
      if (session._rowNumber) await updateSheetRow("sessions", session._rowNumber, session);
      state.sessions = state.sessions.map((item) => (item.id === session.id ? session : item));
    }
  } catch {
    queueSyncWork("document_upsert", session.id, {});
    lastDocumentSyncError = "מסמך התיעוד עדיין לא הסתנכרן; המערכת תנסה שוב אוטומטית.";
  }

  state.sessions = state.sessions.sort((a, b) =>
    `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
  );
  state.currentSessionId = "";

  await saveSessionGoalUpdates(form, session);

  if (!session.summary?.trim()) {
    await createSystemTask(patientId, "השלמת תיעוד מפגש", `מפגש מתאריך ${formatDate(session.session_date)} נשמר ללא סיכום.`, session.session_date);
  }
  return session;
}

async function unlinkSessionPayments(sessionId) {
  const linkedPayments = state.payments.filter((payment) => payment.session_id === sessionId);
  for (const payment of linkedPayments) {
    if (!payment._rowNumber) continue;
    const updated = {
      ...payment,
      session_id: "",
      updated_at: new Date().toISOString()
    };
    await updateSheetRow("payments", payment._rowNumber, updated);
    state.payments = state.payments.map((item) => (item.id === payment.id ? updated : item));
  }
}

async function deleteSessionRecord(sessionId) {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("המפגש לא נמצא.");
  if (!session._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת מפגש.");
  const hasCharge = state.sessionCharges.some((charge) => charge.session_id === sessionId);
  const hasAllocation = state.paymentAllocations.some((allocation) => allocation.session_id === sessionId);
  if (hasCharge || hasAllocation) {
    throw new Error("אי אפשר למחוק מפגש שיש לו חיוב טיפול או תשלום משויך. אפשר לעדכן את פרטי המפגש במקום למחוק אותו.");
  }

  await assertSheetRowCurrent("sessions", session._rowNumber, session);
  if (session.calendar_event_id) {
    try {
      await deleteCalendarEvent(session.calendar_event_id);
    } catch {
      queueSyncWork("calendar_delete", session.id, { eventId: session.calendar_event_id });
      lastCalendarSyncError = "מחיקת האירוע מהיומן ממתינה לסנכרון חוזר.";
    }
  }

  const documentRecord = sessionDocumentRecord(session);
  if (documentRecord?.id) {
    try {
      await deleteFileRecord(documentRecord.id);
    } catch {
      // The session can still be removed even if an old document reference cannot be cleaned.
    }
  }

  await unlinkSessionPayments(sessionId);
  await clearSheetRow("sessions", session._rowNumber, session);
  state.sessions = state.sessions.filter((item) => item.id !== sessionId);
  if (state.currentSessionId === sessionId) state.currentSessionId = "";
}

async function savePayment(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  const selectedChargeIds = formData.getAll("charge_ids").map(String).filter(Boolean);
  const patientId = form.dataset.patientId || "";
  const existingId = form.dataset.id || "";
  const existingPayment = existingId ? state.payments.find((payment) => payment.id === existingId) : null;
  const receiptUpload = form.elements.receipt_upload?.files?.[0];

  if (!patientId) throw new Error("לא נמצא מטופל לשמירת התשלום.");
  if (!data.amount) throw new Error("סכום התשלום הוא שדה חובה.");
  if (existingId && !existingPayment) throw new Error("התשלום לעריכה לא נמצא.");
  if (existingPayment && !existingPayment._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת התשלום.");
  if (existingPayment) await assertSheetRowCurrent("payments", existingPayment._rowNumber, existingPayment);

  const previousAllocations = existingPayment
    ? state.paymentAllocations.filter((allocation) => allocation.payment_id === existingPayment.id)
    : [];
  if (previousAllocations.some((allocation) => !allocation._rowNumber)) {
    throw new Error("צריך לרענן נתונים לפני עדכון שיוך התשלום.");
  }

  let plannedAllocations = [];
  if (selectedChargeIds.length) {
    const amountAgorot = PaymentsCore.parseAmountToAgorot(data.amount);
    if (amountAgorot === null) throw new Error("סכום התשלום אינו תקין. יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.");
    const selectedCharges = state.sessionCharges.filter(
      (charge) => charge.patient_id === patientId && selectedChargeIds.includes(charge.id)
    );
    if (selectedCharges.length !== selectedChargeIds.length) {
      throw new Error("חלק מחיובי הטיפול שנבחרו לא נמצאו. יש לרענן נתונים ולנסות שוב.");
    }
    const otherAllocations = state.paymentAllocations.filter(
      (allocation) => allocation.payment_id !== (existingPayment?.id || "")
    );
    const selectedBalances = PaymentsCore.chargeBalances(selectedCharges, otherAllocations);
    if (selectedBalances.some((balance) => balance.remainingAgorot <= 0)) {
      throw new Error("אחד מחיובי הטיפול שנבחרו כבר שולם במלואו. אפשר לשייך תשלום רק לחיובים פתוחים.");
    }
    const plan = PaymentsCore.planAllocations(selectedBalances, amountAgorot);
    if (plan.error === "invalid_amount") throw new Error("סכום התשלום אינו תקין. יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.");
    if (plan.error === "overpayment") throw new Error("סכום התשלום גבוה מסך היתרה הפתוחה של החיובים שנבחרו. יש להקטין את הסכום או לבחור חיובים נוספים.");
    plannedAllocations = plan.allocations;
  }

  const now = new Date().toISOString();
  const receiptFile = receiptUpload
    ? await uploadPatientFile(patientId, receiptUpload, "receipt", receiptUpload.name)
    : null;
  if (receiptFile && existingPayment?.receipt_file_id) {
    await deleteFileRecordByDriveId(existingPayment.receipt_file_id);
  }
  const linkedSessionId =
    selectedChargeIds.length === 1
      ? plannedAllocations[0]?.sessionId || ""
      : selectedChargeIds.length > 1
        ? ""
        : existingPayment?.session_id || "";
  const payment = {
    ...(existingPayment || {}),
    id: existingPayment?.id || id(),
    patient_id: patientId,
    session_id: linkedSessionId,
    amount: data.amount,
    payment_method: data.payment_method || "bank_transfer",
    payment_status: data.payment_status || "paid",
    receipt_status: receiptFile ? "issued" : data.receipt_status || "needed",
    paid_at: data.paid_at || isoDate(new Date()),
    receipt_file_id: receiptFile?.drive_file_id || existingPayment?.receipt_file_id || "",
    notes: data.notes || "",
    created_at: existingPayment?.created_at || now,
    updated_at: now
  };

  if (existingPayment) {
    await updateSheetRow("payments", existingPayment._rowNumber, payment);
    payment._rowNumber = existingPayment._rowNumber;
    state.payments = state.payments.map((item) => (item.id === payment.id ? payment : item));
  } else {
    const appendResult = await appendSheet("payments", payment);
    payment._rowNumber = appendedRowNumber(appendResult);
    state.payments = [payment, ...state.payments];
  }

  const appendedAllocations = [];
  const clearedAllocations = [];
  try {
    for (const planned of plannedAllocations) {
      const allocation = {
        id: id(),
        payment_id: payment.id,
        charge_id: planned.chargeId,
        session_id: planned.sessionId,
        patient_id: patientId,
        amount: PaymentsCore.agorotToAmountText(planned.amountAgorot),
        created_at: now,
        updated_at: now
      };
      const allocationResult = await appendSheet("payment_allocations", allocation);
      allocation._rowNumber = appendedRowNumber(allocationResult);
      appendedAllocations.push(allocation);
      state.paymentAllocations = [allocation, ...state.paymentAllocations];
    }
    for (const previous of previousAllocations) {
      await clearSheetRow("payment_allocations", previous._rowNumber, previous);
      clearedAllocations.push(previous);
      state.paymentAllocations = state.paymentAllocations.filter((item) => item.id !== previous.id);
    }
  } catch (allocationError) {
    for (const allocation of appendedAllocations) {
      await clearSheetRow("payment_allocations", allocation._rowNumber, allocation).catch(() => {});
      state.paymentAllocations = state.paymentAllocations.filter((item) => item.id !== allocation.id);
    }
    for (const previous of clearedAllocations) {
      const restoredResult = await appendSheet("payment_allocations", WorkflowCore.cleanRecord(previous)).catch(() => null);
      if (restoredResult) {
        const restored = { ...WorkflowCore.cleanRecord(previous), _rowNumber: appendedRowNumber(restoredResult) };
        state.paymentAllocations = [restored, ...state.paymentAllocations];
      }
    }
    if (existingPayment) {
      await updateSheetRow("payments", payment._rowNumber, existingPayment, payment).catch(() => {});
      state.payments = state.payments.map((item) => (item.id === existingPayment.id ? existingPayment : item));
    } else {
      await clearSheetRow("payments", payment._rowNumber, payment).catch(() => {});
      state.payments = state.payments.filter((item) => item.id !== payment.id);
    }
    throw new Error(`שמירת שיוך התשלום נכשלה והרשומות הוחזרו לאחור: ${allocationError.message || allocationError}`);
  }
  state.currentPaymentId = "";
  state.payments = state.payments.sort((a, b) =>
    `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
  );

  if (payment.payment_status !== "paid") {
    await createSystemTask(patientId, "מעקב תשלום פתוח", `תשלום פתוח: ${formatAmount(payment.amount)}`, payment.paid_at);
  }
  if (payment.payment_status === "paid" && payment.receipt_status !== "issued") {
    await createSystemTask(patientId, "הפקת קבלה", `נדרשת קבלה עבור תשלום: ${formatAmount(payment.amount)}`, payment.paid_at);
  }

  try {
    await syncPaymentIncomeRecord(payment, Boolean(receiptFile));
  } catch (syncError) {
    const detail = syncError.message || syncError;
    if (receiptFile) {
      throw new Error(
        `התשלום נשמר, אך סנכרון רשומת ההכנסה בניהול העסק נכשל: ${detail} שמירה חוזרת של התשלום תבצע את הסנכרון מחדש.`
      );
    }
    throw new Error(`סנכרון רשומת ההכנסה בניהול העסק נכשל: ${detail}`);
  }
}

async function deleteFileRecordByDriveId(driveFileId) {
  if (!driveFileId) return;
  const file = state.files.find((item) => item.drive_file_id === driveFileId);
  if (file?.id) {
    await deleteFileRecord(file.id);
    return;
  }
  await trashDriveFile(driveFileId);
}

async function deletePaymentRecord(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("התשלום לא נמצא.");
  if (!payment._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת התשלום.");

  const paymentAllocations = state.paymentAllocations.filter((allocation) => allocation.payment_id === paymentId);
  if (paymentAllocations.some((allocation) => !allocation._rowNumber)) {
    throw new Error("צריך לרענן נתונים לפני מחיקת התשלום.");
  }

  await assertSheetRowCurrent("payments", payment._rowNumber, payment);
  const linkedIncomeRecord = paymentIncomeRecord(paymentId);
  if (linkedIncomeRecord) {
    try {
      await deleteBusinessRecordEntry(linkedIncomeRecord.id);
    } catch (incomeError) {
      throw new Error(
        `מחיקת רשומת ההכנסה המקושרת בניהול העסק נכשלה והתשלום לא נמחק: ${incomeError.message || incomeError}`
      );
    }
  }
  if (payment.receipt_file_id) await deleteFileRecordByDriveId(payment.receipt_file_id);
  for (const allocation of paymentAllocations) {
    await clearSheetRow("payment_allocations", allocation._rowNumber, allocation);
    state.paymentAllocations = state.paymentAllocations.filter((item) => item.id !== allocation.id);
  }
  await clearSheetRow("payments", payment._rowNumber, payment);
  state.payments = state.payments.filter((item) => item.id !== paymentId);
  if (state.currentPaymentId === paymentId) state.currentPaymentId = "";
}

function chargePaymentBlockError(charge) {
  const hasAllocation = state.paymentAllocations.some((allocation) => allocation.charge_id === charge.id);
  const hasLinkedPayment = state.payments.some((payment) => payment.session_id && payment.session_id === charge.session_id);
  if (hasAllocation || hasLinkedPayment) {
    return "לחיוב זה משויך תשלום. כדי לערוך או לבטל את החיוב יש למחוק קודם את התשלום המשויך.";
  }
  return "";
}

async function updateSessionChargeAmount(chargeId, amountText) {
  const charge = state.sessionCharges.find((item) => item.id === chargeId);
  if (!charge) throw new Error("חיוב הטיפול לא נמצא.");
  if (!charge._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון החיוב.");
  const blockError = chargePaymentBlockError(charge);
  if (blockError) throw new Error(blockError);
  const amountAgorot = PaymentsCore.parseAmountToAgorot(amountText);
  if (amountAgorot === null) {
    throw new Error("סכום החיוב אינו תקין. יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה.");
  }

  await assertSheetRowCurrent("session_charges", charge._rowNumber, charge);
  const updated = {
    ...charge,
    amount: PaymentsCore.agorotToAmountText(amountAgorot),
    updated_at: new Date().toISOString()
  };
  await updateSheetRow("session_charges", charge._rowNumber, updated);
  state.sessionCharges = state.sessionCharges.map((item) => (item.id === chargeId ? updated : item));
}

async function cancelSessionCharge(chargeId) {
  const charge = state.sessionCharges.find((item) => item.id === chargeId);
  if (!charge) throw new Error("חיוב הטיפול לא נמצא.");
  if (!charge._rowNumber) throw new Error("צריך לרענן נתונים לפני ביטול החיוב.");
  const blockError = chargePaymentBlockError(charge);
  if (blockError) throw new Error(blockError);

  await assertSheetRowCurrent("session_charges", charge._rowNumber, charge);
  await clearSheetRow("session_charges", charge._rowNumber, charge);
  state.sessionCharges = state.sessionCharges.filter((item) => item.id !== chargeId);
  if (state.currentChargeId === chargeId) state.currentChargeId = "";
}

async function deletePaymentReceipt(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("התשלום לא נמצא.");
  if (!payment._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון התשלום.");
  if (!payment.receipt_file_id) return;

  await assertSheetRowCurrent("payments", payment._rowNumber, payment);
  await deleteFileRecordByDriveId(payment.receipt_file_id);
  const updated = {
    ...payment,
    receipt_file_id: "",
    receipt_status: "needed",
    updated_at: new Date().toISOString()
  };
  await updateSheetRow("payments", payment._rowNumber, updated);
  state.payments = state.payments.map((item) => (item.id === paymentId ? updated : item));
}

async function setPaymentStatus(paymentId, status) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("התשלום לא נמצא.");
  if (!payment._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון התשלום.");

  const updated = {
    ...payment,
    payment_status: status || "unpaid",
    updated_at: new Date().toISOString()
  };
  await updateSheetRow("payments", payment._rowNumber, updated);
  state.payments = state.payments.map((item) => (item.id === paymentId ? updated : item));

  if (updated.payment_status !== "paid") {
    await createSystemTask(updated.patient_id, "מעקב תשלום פתוח", `תשלום פתוח: ${formatAmount(updated.amount)}`, updated.paid_at);
  }
  if (updated.payment_status === "paid" && updated.receipt_status !== "issued") {
    await createSystemTask(updated.patient_id, "הפקת קבלה", `נדרשת קבלה עבור תשלום: ${formatAmount(updated.amount)}`, updated.paid_at);
  }
}

async function setReceiptStatus(paymentId, status) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("התשלום לא נמצא.");
  if (!payment._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון התשלום.");

  const updated = {
    ...payment,
    receipt_status: status || "needed",
    updated_at: new Date().toISOString()
  };
  await updateSheetRow("payments", payment._rowNumber, updated);
  state.payments = state.payments.map((item) => (item.id === paymentId ? updated : item));
}

function csvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadTextFile(fileName, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function backupFileName() {
  return `clinic-manager-backup-${isoDate(new Date())}.json`;
}

function backupPayload() {
  return {
    exported_at: new Date().toISOString(),
    app: "clinic-manager",
    version: "browser-storage-v3-clinical",
    config: {
      googleDriveRootFolderId: state.config.googleDriveRootFolderId || "",
      googleTemplatesFolderId: state.config.googleTemplatesFolderId || "",
      googleCalendarId: state.config.googleCalendarId || "primary",
      googleSpreadsheetId: state.config.googleSpreadsheetId || "",
      allowedUserEmails: state.config.allowedUserEmails || "",
      sessionTypes: state.config.sessionTypes || "",
      sessionLocations: state.config.sessionLocations || ""
    },
    counts: {
      patients: state.patients.length,
      sessions: state.sessions.length,
      payments: state.payments.length,
      tasks: state.tasks.length,
      files: state.files.length,
      contacts: state.contacts.length,
      goals: state.goals.length,
      goal_updates: state.goalUpdates.length,
      questionnaire_templates: state.questionnaireTemplates.length,
      questionnaire_assignments: state.questionnaireAssignments.length,
      questionnaire_responses: state.questionnaireResponses.length,
      clinical_reports: state.clinicalReports.length,
      business_records: state.businessRecords.length,
      session_charges: state.sessionCharges.length,
      payment_allocations: state.paymentAllocations.length,
      schedule_exceptions: state.scheduleExceptions.length,
      audit_log: state.auditLog.length
    },
    data: {
      patients: state.patients,
      sessions: state.sessions,
      payments: state.payments,
      tasks: state.tasks,
      files: state.files,
      contacts: state.contacts,
      goals: state.goals,
      goal_updates: state.goalUpdates,
      questionnaire_templates: state.questionnaireTemplates,
      questionnaire_assignments: state.questionnaireAssignments,
      questionnaire_responses: state.questionnaireResponses,
      clinical_reports: state.clinicalReports,
      business_records: state.businessRecords,
      session_charges: state.sessionCharges,
      payment_allocations: state.paymentAllocations,
      schedule_exceptions: state.scheduleExceptions,
      audit_log: state.auditLog
    }
  };
}

function downloadBackup() {
  downloadTextFile(
    backupFileName(),
    JSON.stringify(backupPayload(), null, 2),
    "application/json;charset=utf-8"
  );
}

async function saveBackupToDrive() {
  if (!state.config.googleDriveRootFolderId) throw new Error("צריך להגדיר תיקיית אחסון ראשית לפני שמירת גיבוי.");
  const content = JSON.stringify(backupPayload(), null, 2);
  const file = new File([content], backupFileName(), { type: "application/json" });
  return uploadDriveFile(state.config.googleDriveRootFolderId, file, file.name);
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

async function clearSheetData(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A2:${columnLetter(columns.length)}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
  await googleFetch(url, {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function replaceSheetData(sheetName, rows) {
  await clearSheetData(sheetName);
  for (const row of rows) {
    await appendSheet(sheetName, row);
  }
}

async function restoreBackupFile(file) {
  if (!file) throw new Error("צריך לבחור קובץ גיבוי.");
  if (!canUseStorage()) throw new Error("צריך להתחבר לחשבון מורשה לפני שחזור.");

  const payload = JSON.parse(await file.text());
  for (const tableName of ["goals", "goal_updates", "questionnaire_templates", "questionnaire_assignments", "questionnaire_responses", "clinical_reports", "business_records", "session_charges", "payment_allocations"]) {
    if (payload?.data && !Array.isArray(payload.data[tableName])) payload.data[tableName] = [];
  }
  if (payload?.data && !Array.isArray(payload.data.audit_log)) payload.data.audit_log = [];
  WorkflowCore.validateBackup(payload, Object.keys(SHEETS));
  const rollbackPayload = backupPayload();
  await saveBackupToDrive();
  try {
    for (const tableName of Object.keys(SHEETS)) {
      await replaceSheetData(tableName, backupRows(payload, tableName));
    }
  } catch (restoreError) {
    try {
      for (const tableName of Object.keys(SHEETS)) {
        await replaceSheetData(tableName, backupRows(rollbackPayload, tableName));
      }
    } catch (rollbackError) {
      throw new Error(`השחזור נכשל וגם החזרת המצב הקודם נכשלה: ${rollbackError.message || rollbackError}`);
    }
    throw new Error(`השחזור נכשל והנתונים הקודמים הוחזרו: ${restoreError.message || restoreError}`);
  }
  await loadData();
  await appendAuditEntry(
    { actionType: "restore", entityType: "backup", summary: "שחזור מגיבוי מאומת", undoable: false },
    []
  );
  return Object.fromEntries(Object.keys(SHEETS).map((tableName) => [tableName, backupRows(payload, tableName).length]));
}

const EXPORT_TABLES = {
  patients: {
    fileName: "patients",
    rows: () => state.patients,
    columns: [
      ["שם", "child_name"],
      ["מוסד", "school_name"],
      ["סוג טיפול", "treatment_type"],
      ["יום קבוע", "fixed_day"],
      ["שעה קבועה", "fixed_time"],
      ["מחיר קבוע", "fixed_price"],
      ["סטטוס", "status"]
    ]
  },
  payments: {
    fileName: "payments",
    rows: () => state.payments,
    columns: [
      ["תאריך", "paid_at"],
      ["מטופל", (payment) => patientName(payment.patient_id)],
      ["סכום", "amount"],
      ["אמצעי", (payment) => paymentMethodLabel(payment.payment_method)],
      ["תשלום", (payment) => paymentStatusLabel(payment.payment_status)],
      ["קבלה", (payment) => receiptStatusLabel(payment.receipt_status)],
      ["הערות", "notes"]
    ]
  },
  tasks: {
    fileName: "tasks",
    rows: () => state.tasks,
    columns: [
      ["תאריך יעד", "due_date"],
      ["מטופל", (task) => patientName(task.patient_id)],
      ["משימה", "title"],
      ["סטטוס", (task) => taskStatusLabel(task.status)],
      ["פירוט", "description"],
      ["מקור", "source"]
    ]
  }
};

function exportTableCsv(tableKey) {
  const table = EXPORT_TABLES[tableKey];
  if (!table) throw new Error("טבלת הייצוא לא נמצאה.");
  const rows = table.rows();
  const headerRow = table.columns.map(([label]) => label);
  const csvRows = [
    headerRow.map(csvValue).join(","),
    ...rows.map((row) =>
      table.columns
        .map(([, getter]) => (typeof getter === "function" ? getter(row) : row[getter] || ""))
        .map(csvValue)
        .join(",")
    )
  ];
  downloadTextFile(
    `${table.fileName}-${isoDate(new Date())}.csv`,
    `\uFEFF${csvRows.join("\n")}`,
    "text/csv;charset=utf-8"
  );
  return rows.length;
}

function exportReceiptsCsv() {
  const rows = state.payments
    .filter((payment) => payment.payment_status === "paid" && payment.receipt_status !== "issued")
    .sort((a, b) => `${a.paid_at} ${a.created_at}`.localeCompare(`${b.paid_at} ${b.created_at}`));
  if (!rows.length) return 0;
  const headerRow = ["תאריך", "מטופל", "סכום", "אמצעי תשלום", "מפגש", "הערות"];
  const csvRows = [
    headerRow.map(csvValue).join(","),
    ...rows.map((payment) =>
      [
        formatDate(payment.paid_at),
        patientName(payment.patient_id),
        payment.amount || "",
        paymentMethodLabel(payment.payment_method),
        payment.session_id ? sessionLabelById(payment.session_id) : "",
        payment.notes || ""
      ]
        .map(csvValue)
        .join(",")
    )
  ];
  downloadTextFile(`receipts-to-prepare-${isoDate(new Date())}.csv`, `\uFEFF${csvRows.join("\n")}`, "text/csv;charset=utf-8");
  return rows.length;
}

async function createSystemTask(patientId, title, description = "", dueDate = "") {
  const exists = state.tasks.some(
    (task) =>
      task.patient_id === patientId &&
      task.title === title &&
      task.status !== "done" &&
      (task.due_date || "") === (dueDate || "")
  );
  if (exists) return null;

  const now = new Date().toISOString();
  const task = {
    id: id(),
    patient_id: patientId,
    title,
    description,
    status: "open",
    due_date: dueDate || isoDate(new Date()),
    source: "auto",
    created_at: now,
    updated_at: now,
    reminder_at: dueDate || isoDate(new Date())
  };
  const appendResult = await appendSheet("tasks", task);
  task._rowNumber = appendedRowNumber(appendResult);
  state.tasks = [task, ...state.tasks].sort((a, b) =>
    `${a.due_date || "9999-99-99"} ${a.created_at}`.localeCompare(`${b.due_date || "9999-99-99"} ${b.created_at}`)
  );
  return task;
}

async function saveTask(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || data.patient_id || "";
  const existingId = form.dataset.id || "";
  const existingTask = existingId ? state.tasks.find((task) => task.id === existingId) : null;

  if (!patientId) throw new Error("צריך לבחור מטופל למשימה.");
  if (!data.title) throw new Error("כותרת המשימה היא שדה חובה.");
  if (existingId && !existingTask) throw new Error("המשימה לעריכה לא נמצאה.");
  if (existingTask && !existingTask._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת המשימה.");

  const now = new Date().toISOString();
  const task = {
    ...(existingTask || {}),
    id: existingTask?.id || id(),
    patient_id: patientId,
    title: data.title,
    description: data.description || "",
    status: data.status || "open",
    due_date: data.due_date || "",
    source: existingTask?.source || "manual",
    created_at: existingTask?.created_at || now,
    updated_at: now,
    reminder_at: data.reminder_at || data.due_date || ""
  };

  if (existingTask) {
    await updateSheetRow("tasks", existingTask._rowNumber, task);
    state.tasks = state.tasks.map((item) => (item.id === task.id ? task : item));
  } else {
    const appendResult = await appendSheet("tasks", task);
    task._rowNumber = appendedRowNumber(appendResult);
    state.tasks = [task, ...state.tasks];
  }
  state.currentTaskId = "";
  state.tasks = state.tasks.sort((a, b) =>
    `${a.due_date || "9999-99-99"} ${a.created_at}`.localeCompare(`${b.due_date || "9999-99-99"} ${b.created_at}`)
  );
}

async function deleteTaskRecord(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("המשימה לא נמצאה.");
  if (!task._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת המשימה.");

  await clearSheetRow("tasks", task._rowNumber, task);
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  if (state.currentTaskId === taskId) state.currentTaskId = "";
}

async function completeTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("המשימה לא נמצאה.");
  if (!task._rowNumber) throw new Error("לא ניתן לעדכן את המשימה לפני רענון הנתונים.");

  const updated = {
    ...task,
    status: "done",
    updated_at: new Date().toISOString()
  };

  await updateSheetRow("tasks", task._rowNumber, updated);
  state.tasks = state.tasks.map((item) => (item.id === taskId ? updated : item));
}

async function saveFile(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || data.patient_id || "";
  const selectedFile = form.elements.upload?.files?.[0];
  const existingId = form.dataset.id || "";
  const existingFile = existingId ? state.files.find((file) => file.id === existingId) : null;
  const fileName = fileNameWithFallback(data.name, selectedFile);

  if (!patientId) throw new Error("צריך לבחור מטופל לקובץ.");
  if (!existingFile && !selectedFile) throw new Error("צריך לבחור קובץ להעלאה.");
  if (existingId && !existingFile) throw new Error("הקובץ לעריכה לא נמצא.");
  if (existingFile && !existingFile._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת הקובץ.");
  if (existingFile) await assertSheetRowCurrent("files", existingFile._rowNumber, existingFile);

  if (!existingFile) {
    await uploadPatientFile(patientId, selectedFile, data.file_type || "document", fileName);
    return;
  }

  const now = new Date().toISOString();
  const replacement = selectedFile
    ? await uploadPatientFile(patientId, selectedFile, data.file_type || existingFile.file_type, fileName || selectedFile.name)
    : null;

  if (replacement) {
    if (existingFile.drive_file_id) {
      await updateLinkedFileReferences(existingFile.drive_file_id, replacement.drive_file_id);
      await trashDriveFile(existingFile.drive_file_id);
    }
    await clearSheetRow("files", existingFile._rowNumber, existingFile);
    state.files = state.files.filter((file) => file.id !== existingFile.id);
    state.currentFileId = "";
    return;
  }

  const updatedName = fileName || existingFile.name || "";
  if (updatedName && updatedName !== existingFile.name && existingFile.drive_file_id) {
    await updateDriveFileName(existingFile.drive_file_id, updatedName);
  }
  let nextFolderId = existingFile.drive_folder_id || "";
  if (patientId !== existingFile.patient_id && existingFile.drive_file_id) {
    const nextPatient = await ensurePatientDriveFolder(patientId);
    await moveDriveFile(existingFile.drive_file_id, existingFile.drive_folder_id, nextPatient.drive_folder_id);
    nextFolderId = nextPatient.drive_folder_id || nextFolderId;
  }

  const updated = {
    ...existingFile,
    patient_id: patientId,
    drive_folder_id: nextFolderId,
    name: updatedName,
    file_type: data.file_type || existingFile.file_type || "document",
    updated_at: now
  };
  await updateSheetRow("files", existingFile._rowNumber, updated);
  state.files = state.files.map((file) => (file.id === existingFile.id ? updated : file));
  state.currentFileId = "";
}

async function createFileFromTemplate(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const patient = await ensurePatientDriveFolder(patientId);
  const template = state.templates.find((item) => item.id === data.template_id);

  if (!template) throw new Error("צריך לבחור תבנית.");

  const fileName =
    data.name ||
    `${template.name || "מסמך"} - ${patient.child_name || "מטופל"} - ${isoDate(new Date())}`;
  const result = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(template.id)}/copy?fields=id,name,mimeType,webViewLink,createdTime`,
    {
      method: "POST",
      body: JSON.stringify({
        name: fileName,
        parents: [patient.drive_folder_id]
      })
    }
  );
  const now = new Date().toISOString();
  const file = {
    id: id(),
    patient_id: patientId,
    drive_file_id: result.id || "",
    drive_folder_id: patient.drive_folder_id || "",
    name: result.name || fileName,
    file_type: driveFileTypeLabel(result.mimeType || template.mimeType),
    url: result.webViewLink || driveFileUrl(result.id),
    created_at: result.createdTime || now,
    updated_at: now
  };

  await appendFileRecord(file);
}

async function startRecording(patientId) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error("הדפדפן לא תומך בהקלטה ישירה.");
  }
  if (activeRecorder?.state === "recording") throw new Error("כבר מתבצעת הקלטה.");
  if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני הקלטה.");

  activeRecordingPatientId = patientId;
  activeRecordingChunks = [];
  activeRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  activeRecorder = new MediaRecorder(activeRecordingStream);
  activeRecorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) activeRecordingChunks.push(event.data);
  });
  activeRecorder.addEventListener("stop", async () => {
    const patientIdForUpload = activeRecordingPatientId;
    const patientNameValue = patientName(patientIdForUpload);
    const mimeType = activeRecorder?.mimeType || "audio/webm";
    const blob = new Blob(activeRecordingChunks, { type: mimeType });
    activeRecordingStream?.getTracks().forEach((track) => track.stop());
    activeRecorder = null;
    activeRecordingStream = null;
    activeRecordingPatientId = "";
    activeRecordingChunks = [];

    try {
      const file = new File(
        [blob],
        `הקלטה - ${patientNameValue} - ${new Date()
          .toISOString()
          .slice(0, 19)
          .replaceAll(":", "-")}.webm`,
        { type: mimeType }
      );
      await uploadPatientFile(patientIdForUpload, file, "recording", file.name);
      await createSystemTask(
        patientIdForUpload,
        "עיבוד הקלטה",
        "הקלטה חדשה נשמרה בתיקיית המטופל וממתינה לתמלול/עיבוד.",
        isoDate(new Date())
      );
      state.message = "ההקלטה נשמרה בתיקיית המטופל.";
      state.error = "";
    } catch (error) {
      state.error = error instanceof Error ? error.message : "שמירת ההקלטה נכשלה.";
      state.message = "";
    }
    render();
  });
  activeRecorder.start();
}

function stopRecording() {
  if (!activeRecorder || activeRecorder.state !== "recording") {
    throw new Error("אין הקלטה פעילה לעצירה.");
  }
  activeRecorder.stop();
}

function bindEvents() {
  document.addEventListener("keydown", handleDrawerKeyboard);
  document.addEventListener("keydown", handlePickerKeyboard);

  document.addEventListener("click", async (event) => {
    if (event.target.closest(".picker-popover")) return;

    const dateInput = event.target.closest("[data-date-input]");
    if (dateInput) {
      event.preventDefault();
      showDatePicker(dateInput);
      return;
    }

    const timeInput = event.target.closest("[data-time-input]");
    if (timeInput) {
      event.preventDefault();
      showTimePicker(timeInput);
      return;
    }

    closePicker();

    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const busyKey = beginBusyAction(target);
    if (!busyKey) return;

    try {
    if (action === "cancel-upload") {
      uploadCancelled = true;
      activeUploadRequest?.abort();
    }
    if (action === "retry-sync") {
      state.syncQueue.forEach((item) => {
        item.nextAttemptAt = Date.now();
      });
      persistSyncQueue();
      await processSyncQueue(true);
      state.message = state.syncQueue.length
        ? "חלק מהפעולות עדיין ממתינות; המערכת תמשיך לנסות אוטומטית."
        : "כל הפעולות הסתנכרנו.";
      render();
    }
    if (action === "connect-google") await connectGoogle();
    if (action === "force-connect-google") await connectGoogle(true);
    if (action === "disconnect-google") disconnectGoogle();
    if (action === "reset-google-settings") {
      if (!window.confirm("לאפס את הגדרות Google המקומיות לערכים שמוגדרים בקובץ config.js?")) return;
      resetConfigToDefaults();
      state.message = "הגדרות Google המקומיות אופסו לברירת המחדל.";
      state.error = "";
      render();
    }
    if (action === "refresh") {
      await loadData().catch((error) => {
        state.error = error.message;
      });
      render();
    }
    if (action === "undo-last-action") {
      if (!window.confirm("לבטל את הפעולה ולשחזר את הנתונים הקודמים?")) return;
      try {
        await undoAuditAction(target.dataset.id || state.lastUndoActionId);
        state.message = "הפעולה בוטלה והנתונים הקודמים שוחזרו.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "ביטול הפעולה נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "check-storage") {
      try {
        const folderName = await checkStorageConnection();
        state.message = `החיבור תקין. תיקיית אחסון ראשית: ${folderName}`;
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "בדיקת החיבור נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "check-data-health") {
      try {
        const report = await runDataHealthCheck();
        state.message = report.ok ? "מבנה הנתונים תקין." : "נמצאו בעיות במבנה הנתונים. אפשר ללחוץ תיקון מבנה.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "בדיקת תקינות הנתונים נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "check-sharing-security") {
      try {
        const report = await runSharingSecurityAudit();
        state.message = report.ok
          ? "משאבי הקליניקה אינם משותפים לציבור."
          : "נמצאה גישה ציבורית. יש ללחוץ הסרת גישה ציבורית.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "בדיקת אבטחת השיתוף נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "repair-sharing-security") {
      try {
        const removed = await repairSharingSecurity();
        state.message = removed
          ? `הוסרו ${removed} הרשאות שיתוף ציבוריות.`
          : "לא נמצאו הרשאות שיתוף ציבוריות.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "תיקון אבטחת השיתוף נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "repair-data-health") {
      if (!window.confirm("תיקון מבנה יעדכן את שורת הכותרות ויצור גיליונות חסרים. להמשיך?")) return;
      try {
        const report = await runDataHealthCheck({ repair: true });
        state.message = report.ok ? "מבנה הנתונים תוקן ונבדק." : "נשארו נקודות שדורשות בדיקה ידנית.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "תיקון מבנה הנתונים נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "download-backup") {
      downloadBackup();
      state.message = "גיבוי מלא ירד למחשב.";
      state.error = "";
      render();
    }
    if (action === "save-backup-drive") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירת גיבוי.");
        const result = await saveBackupToDrive();
        state.message = `הגיבוי נשמר באחסון: ${result.name || backupFileName()}.`;
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "שמירת הגיבוי נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "restore-backup") {
      const fileInput = document.getElementById("restoreBackupFile");
      const selectedFile = fileInput?.files?.[0];
      if (!selectedFile) {
        state.error = "צריך לבחור קובץ גיבוי לשחזור.";
        state.message = "";
        render();
        return;
      }
      if (!window.confirm("שחזור מגיבוי יחליף את הנתונים הקיימים בטבלאות. להמשיך?")) return;

      try {
        const counts = await restoreBackupFile(selectedFile);
        state.message = `השחזור הושלם: ${counts.patients || 0} מטופלים, ${counts.sessions || 0} מפגשים, ${counts.payments || 0} תשלומים, ${counts.tasks || 0} משימות.`;
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "שחזור הגיבוי נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "export-table") {
      try {
        const count = exportTableCsv(target.dataset.table || "");
        state.message = `נוצר קובץ ייצוא עם ${count} רשומות.`;
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "הייצוא נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "open-patient-drawer") {
      openPatientDrawer(target);
    }
    if (action === "close-drawer") {
      closePatientDrawer();
    }
    if (action === "open-profile") {
      state.profileTab = "overview";
      state.currentSessionId = "";
      state.currentPaymentId = "";
      state.currentTaskId = "";
      state.currentFileId = "";
      state.currentContactId = "";
      state.currentGoalId = "";
      navigate(`patients/${target.dataset.id}`);
    }
    if (action === "profile-tab") {
      state.profileTab = target.dataset.tab || "overview";
      if (state.profileTab !== "documentation") state.currentSessionId = "";
      if (state.profileTab !== "payments") state.currentPaymentId = "";
      if (state.profileTab !== "tasks") state.currentTaskId = "";
      if (state.profileTab !== "files") state.currentFileId = "";
      if (state.profileTab !== "contacts") state.currentContactId = "";
      if (state.profileTab !== "goals") state.currentGoalId = "";
      render();
    }
    if (action === "edit-goal") {
      state.currentGoalId = target.dataset.id || "";
      state.profileTab = "goals";
      render();
    }
    if (action === "cancel-goal-edit") {
      state.currentGoalId = "";
      render();
    }
    if (action === "send-questionnaire-whatsapp" || action === "send-questionnaire-email") {
      try {
        const assignment = state.questionnaireAssignments.find((item) => item.id === target.dataset.id);
        const contact = assignment && state.contacts.find((item) => item.id === assignment.contact_id);
        if (!assignment || !contact) throw new Error("השאלון או איש הקשר לא נמצאו.");
        const message = questionnaireMessage(assignment);
        const destination = action === "send-questionnaire-whatsapp"
          ? `https://wa.me/${String(contact.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
          : `mailto:${encodeURIComponent(contact.email || "")}?subject=${encodeURIComponent("שאלון לקראת המשך העבודה")}&body=${encodeURIComponent(message)}`;
        window.open(destination, "_blank", "noopener");
        await markQuestionnaireSent(assignment);
        state.message = "נפתח חלון השליחה עם קישור השאלון.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "פתיחת השליחה נכשלה.";
        render();
      }
    }
    if (action === "sync-questionnaires") {
      try {
        const imported = await syncQuestionnaires(target.dataset.patientId || "");
        state.message = imported ? `נקלטו ${imported} תשובות חדשות.` : "לא נמצאו תשובות חדשות.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "רענון השאלונים נכשל.";
        render();
      }
    }
    if (action === "edit-session") {
      state.currentSessionId = target.dataset.id || "";
      state.profileTab = "documentation";
      render();
    }
    if (action === "cancel-session-edit") {
      state.currentSessionId = "";
      render();
    }
    if (action === "edit-payment") {
      const payment = state.payments.find((item) => item.id === target.dataset.id);
      if (!payment) return;
      state.currentPaymentId = payment.id;
      state.profileTab = "payments";
      if (!state.route.startsWith(`patients/${payment.patient_id}`)) {
        navigate(`patients/${payment.patient_id}`);
      } else {
        render();
      }
    }
    if (action === "cancel-payment-edit") {
      state.currentPaymentId = "";
      render();
    }
    if (action === "edit-business-record") {
      const record = state.businessRecords.find((item) => item.id === target.dataset.id);
      if (record) {
        state.currentBusinessRecordId = record.id;
        const period = BusinessCore.periodForDate(record.document_date);
        if (period) state.businessView = { ...state.businessView, year: period.year, period: period.key };
        render();
      }
    }
    if (action === "cancel-business-edit") {
      state.currentBusinessRecordId = "";
      render();
    }
    if (action === "delete-business-record") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את הרשומה? קובץ המסמך יועבר לאשפה.")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "business_record", entityId: target.dataset.id, summary: "מחיקת רשומת עסק", undoable: false },
          () => deleteBusinessRecordEntry(target.dataset.id)
        );
        if (state.currentBusinessRecordId === target.dataset.id) state.currentBusinessRecordId = "";
        state.message = "הרשומה נמחקה וקובץ המסמך הועבר לאשפה.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת הרשומה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-payment") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את התשלום?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "payment", entityId: target.dataset.id, summary: "מחיקת תשלום", undoable: false },
          () => deletePaymentRecord(target.dataset.id)
        );
        state.message = "התשלום נמחק מהמערכת.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת התשלום נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "edit-charge") {
      const charge = state.sessionCharges.find((item) => item.id === target.dataset.id);
      if (!charge) return;
      const blockError = chargePaymentBlockError(charge);
      if (blockError) {
        state.error = blockError;
        state.message = "";
        render();
        return;
      }
      state.currentChargeId = charge.id;
      state.error = "";
      state.message = "";
      render();
    }
    if (action === "cancel-charge-edit") {
      state.currentChargeId = "";
      render();
    }
    if (action === "save-charge-amount") {
      const amountText = document.querySelector("[data-charge-amount-input]")?.value || "";
      if (!window.confirm("האם לעדכן את סכום חיוב הטיפול? המחיר הקבוע בכרטיס המטופל לא ישתנה.")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "update", entityType: "session_charge", entityId: target.dataset.id, summary: "עדכון סכום חיוב טיפול" },
          () => updateSessionChargeAmount(target.dataset.id, amountText)
        );
        state.currentChargeId = "";
        state.message = "סכום החיוב עודכן.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "עדכון החיוב נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "cancel-charge") {
      if (!window.confirm("האם לבטל את חיוב הטיפול? החוב יוסר מהיתרות, ותיעוד המפגש יישאר במערכת ללא שינוי.")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני ביטול חיוב.");
        await runAuditedAction(
          { actionType: "delete", entityType: "session_charge", entityId: target.dataset.id, summary: "ביטול חיוב טיפול", undoable: false },
          () => cancelSessionCharge(target.dataset.id)
        );
        state.message = "חיוב הטיפול בוטל והוסר מהיתרות.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "ביטול החיוב נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-payment-receipt") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את קובץ הקבלה?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete_receipt", entityType: "payment", entityId: target.dataset.id, summary: "מחיקת קובץ קבלה", undoable: false },
          () => deletePaymentReceipt(target.dataset.id)
        );
        state.message = "קובץ הקבלה נמחק ועודכן ברשומת התשלום.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת הקבלה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "set-payment-status") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "status", entityType: "payment", entityId: target.dataset.id, summary: "עדכון סטטוס תשלום" },
          () => setPaymentStatus(target.dataset.id, target.dataset.status || "unpaid")
        );
        state.message = "סטטוס התשלום עודכן.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "עדכון התשלום נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "set-receipt-status") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "status", entityType: "payment", entityId: target.dataset.id, summary: "עדכון סטטוס קבלה" },
          () => setReceiptStatus(target.dataset.id, target.dataset.status || "issued")
        );
        state.message = "סטטוס הקבלה עודכן.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "עדכון הקבלה נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "export-receipts") {
      const count = exportReceiptsCsv();
      state.message = count ? `נוצר קובץ ייצוא עבור ${count} קבלות להכנה.` : "אין קבלות להכנה כרגע.";
      state.error = "";
      render();
    }
    if (action === "edit-task") {
      const task = state.tasks.find((item) => item.id === target.dataset.id);
      if (!task) return;
      state.currentTaskId = task.id;
      state.profileTab = state.route === "tasks" ? state.profileTab : "tasks";
      if (state.route === "tasks") {
        render();
      } else if (!state.route.startsWith(`patients/${task.patient_id}`)) {
        navigate(`patients/${task.patient_id}`);
      } else {
        render();
      }
    }
    if (action === "cancel-task-edit") {
      state.currentTaskId = "";
      render();
    }
    if (action === "edit-contact") {
      const contact = state.contacts.find((item) => item.id === target.dataset.id);
      if (!contact) return;
      state.currentContactId = contact.id;
      state.profileTab = "contacts";
      if (!state.route.startsWith(`patients/${contact.patient_id}`)) {
        navigate(`patients/${contact.patient_id}`);
      } else {
        render();
      }
    }
    if (action === "cancel-contact-edit") {
      state.currentContactId = "";
      render();
    }
    if (action === "delete-contact") {
      if (!window.confirm("למחוק את איש הקשר?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "contact", entityId: target.dataset.id, summary: "מחיקת איש קשר" },
          () => deleteContactRecord(target.dataset.id)
        );
        state.message = "איש הקשר נמחק.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת איש הקשר נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-task") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את המשימה?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "task", entityId: target.dataset.id, summary: "מחיקת משימה" },
          () => deleteTaskRecord(target.dataset.id)
        );
        state.message = "המשימה נמחקה.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת המשימה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-schedule-exception") {
      if (!window.confirm("למחוק את חריג היומן?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "schedule_exception", entityId: target.dataset.id, summary: "מחיקת חריג יומן" },
          () => deleteScheduleException(target.dataset.id)
        );
        state.message = "חריג היומן נמחק.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת חריג היומן נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-session") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את המפגש?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        lastCalendarSyncError = "";
        await runAuditedAction(
          { actionType: "delete", entityType: "session", entityId: target.dataset.id, summary: "מחיקת מפגש", undoable: false },
          () => deleteSessionRecord(target.dataset.id)
        );
        state.message = lastCalendarSyncError
          ? `המפגש נמחק מהמערכת. ${lastCalendarSyncError}`
          : "המפגש נמחק מהמערכת ומהיומן.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת המפגש נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "toggle-patient-archive") {
      const shouldArchive = target.dataset.archive !== "restore";
      const prompt = shouldArchive
        ? "להעביר את המטופל לארכיון? המידע יישמר ותמיד אפשר להחזיר."
        : "להחזיר את המטופל מרשימת הארכיון?";
      if (!window.confirm(prompt)) return;

      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: shouldArchive ? "archive" : "restore", entityType: "patient", entityId: target.dataset.id, summary: shouldArchive ? "העברת מטופל לארכיון" : "החזרת מטופל לפעילות" },
          () => togglePatientArchive(target.dataset.id, shouldArchive)
        );
        state.message = shouldArchive ? "המטופל הועבר לארכיון." : "המטופל הוחזר לפעילות.";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "הפעולה נכשלה.";
        render();
      }
    }
    if (action === "calendar-prev") {
      state.calendarMonth = shiftMonth(state.calendarMonth, -1);
      render();
    }
    if (action === "calendar-next") {
      state.calendarMonth = shiftMonth(state.calendarMonth, 1);
      render();
    }
    if (action === "calendar-today") {
      const today = isoDate(new Date());
      state.calendarMonth = today.slice(0, 7);
      state.selectedCalendarDate = today;
      render();
    }
    if (action === "select-calendar-date") {
      state.selectedCalendarDate = target.dataset.date || state.selectedCalendarDate;
      state.calendarMonth = state.selectedCalendarDate.slice(0, 7);
      render();
    }
    if (action === "materialize-recurring") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירת מפגש.");
        await runAuditedAction(
          { actionType: "create", entityType: "session", entityId: target.dataset.patientId, summary: "יצירת מפגש קבוע", undoable: false },
          () => materializeRecurringSession(target.dataset.patientId, target.dataset.date)
        );
        const syncMessages = [lastCalendarSyncError, lastDocumentSyncError].filter(Boolean);
        state.message = syncMessages.length
          ? `המפגש הקבוע נשמר במערכת. ${syncMessages.join(" ")}`
          : "המפגש הקבוע נשמר כמפגש רגיל, סונכרן ליומן ונוצר לו מסמך תיעוד.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "שמירת המפגש הקבוע נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "cancel-recurring") {
      if (!window.confirm("לבטל את המפגש הקבוע רק בתאריך הזה?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני ביטול מפגש.");
        await runAuditedAction(
          { actionType: "cancel", entityType: "schedule_exception", entityId: target.dataset.patientId, summary: "ביטול מפגש קבוע בתאריך", undoable: true },
          () => cancelRecurringSession(target.dataset.patientId, target.dataset.date)
        );
        state.message = "המפגש הקבוע בוטל לתאריך הזה בלבד.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "ביטול המפגש הקבוע נכשל.";
        state.message = "";
        render();
      }
    }
    if (action === "reports-prev") {
      state.reportMonth = shiftMonth(state.reportMonth, -1);
      render();
    }
    if (action === "reports-next") {
      state.reportMonth = shiftMonth(state.reportMonth, 1);
      render();
    }
    if (action === "reports-current") {
      state.reportMonth = isoDate(new Date()).slice(0, 7);
      render();
    }
    if (action === "start-recording") {
      try {
        await startRecording(target.dataset.id);
        state.message = "ההקלטה התחילה.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "התחלת ההקלטה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "stop-recording") {
      try {
        stopRecording();
        state.message = "שומר את ההקלטה...";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "עצירת ההקלטה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "create-drive-folder") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "create_folder", entityType: "patient", entityId: target.dataset.id, summary: "יצירת תיקיית מטופל", undoable: false },
          () => ensurePatientDriveFolder(target.dataset.id)
        );
        state.message = "תיקיית המטופל נוצרה ונשמרה במערכת.";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "יצירת התיקייה נכשלה.";
        render();
      }
    }
    if (action === "sync-drive-files") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const count = await runAuditedAction(
          { actionType: "sync", entityType: "file", entityId: target.dataset.id, summary: "סנכרון קבצים מ-Drive", undoable: false },
          () => syncPatientDriveFiles(target.dataset.id)
        );
        state.message = count
          ? `${count} קבצים חדשים נרשמו מתוך תיקיית המטופל.`
          : "לא נמצאו קבצים חדשים לייבוא מהתיקייה.";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "ייבוא הקבצים נכשל.";
        render();
      }
    }
    if (action === "edit-file") {
      const file = state.files.find((item) => item.id === target.dataset.id);
      if (!file) return;
      state.currentFileId = file.id;
      state.profileTab = state.route === "files" ? state.profileTab : "files";
      if (state.route === "files") {
        render();
      } else if (!state.route.startsWith(`patients/${file.patient_id}`)) {
        navigate(`patients/${file.patient_id}`);
      } else {
        render();
      }
    }
    if (action === "cancel-file-edit") {
      state.currentFileId = "";
      render();
    }
    if (action === "create-transcript-draft") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני יצירת מסמך.");
        const draft = await runAuditedAction(
          { actionType: "create", entityType: "file", entityId: target.dataset.id, summary: "יצירת טיוטת תמלול", undoable: false },
          () => createRecordingTranscriptDraft(target.dataset.id)
        );
        state.message = `טיוטת התמלול נוצרה ונשמרה בקבצים: ${draft.name || "מסמך תמלול"}.`;
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "יצירת טיוטת התמלול נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-file") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק?")) return;

      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await runAuditedAction(
          { actionType: "delete", entityType: "file", entityId: target.dataset.id, summary: "מחיקת קובץ", undoable: false },
          () => deleteFileRecord(target.dataset.id)
        );
        state.message = "הקובץ נמחק מכרטיס המטופל ומהתיקייה בדרייב.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת הקובץ נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "complete-task") {
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "complete", entityType: "task", entityId: target.dataset.id, summary: "סימון משימה כבוצעה" },
          () => completeTask(target.dataset.id)
        );
        state.message = "המשימה סומנה כבוצעה.";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "הפעולה נכשלה.";
        render();
      }
    }
    } finally {
      endBusyAction(target, busyKey);
    }
  });

  document.addEventListener("input", (event) => {
    const fileFilter = event.target.closest("[data-file-filter]");
    if (fileFilter) {
      state.fileFilter[fileFilter.dataset.fileFilter] = fileFilter.value;
      if (state.route === "files") {
        const filterKey = fileFilter.dataset.fileFilter;
        const cursor = fileFilter.selectionStart || fileFilter.value.length;
        render();
        const nextTarget = document.querySelector(`[data-file-filter="${filterKey}"]`);
        nextTarget?.focus();
        nextTarget?.setSelectionRange?.(cursor, cursor);
      }
      return;
    }

    const target = event.target.closest("[data-patient-filter]");
    if (!target) return;

    state.patientFilter[target.dataset.patientFilter] = target.value;
    if (state.route === "patients") {
      const filterKey = target.dataset.patientFilter;
      const cursor = target.selectionStart || target.value.length;
      render();
      const nextTarget = document.querySelector(`[data-patient-filter="${filterKey}"]`);
      nextTarget?.focus();
      nextTarget?.setSelectionRange?.(cursor, cursor);
    }
  });

  document.addEventListener("change", (event) => {
    const chargeCheckbox = event.target.closest('[data-charge-select] input[name="charge_ids"]');
    if (chargeCheckbox) {
      const paymentForm = chargeCheckbox.closest('form[data-form="payment"]');
      const amountField = paymentForm?.elements?.amount;
      if (amountField) {
        const selectedRemaining = [...paymentForm.querySelectorAll('[data-charge-select] input[name="charge_ids"]:checked')]
          .reduce((total, input) => total + (Number(input.dataset.chargeRemaining) || 0), 0);
        amountField.value = selectedRemaining > 0 ? PaymentsCore.agorotToAmountText(selectedRemaining) : "";
      }
      return;
    }
    const questionnaireTemplateSelect = event.target.closest("[data-questionnaire-template-select]");
    if (questionnaireTemplateSelect) {
      state.currentQuestionnaireTemplateId = questionnaireTemplateSelect.value || "";
      render();
      return;
    }
    const reportForm = event.target.closest('form[data-form="clinical-report"]');
    if (reportForm && ["report_type", "period_start", "period_end"].includes(event.target.name)) {
      const content = reportForm.elements.content;
      if (content) {
        content.value = clinicalReportDraft(
          reportForm.dataset.patientId || "",
          reportForm.elements.report_type?.value || "progress",
          reportForm.elements.period_start?.value || "",
          reportForm.elements.period_end?.value || ""
        );
      }
      return;
    }
    const businessFilter = event.target.closest("[data-business-filter]");
    if (businessFilter) {
      state.businessView = { ...state.businessView, [businessFilter.dataset.businessFilter]: businessFilter.value };
      if (state.route === "business") render();
      return;
    }
    const fileFilter = event.target.closest("[data-file-filter]");
    if (fileFilter) {
      state.fileFilter[fileFilter.dataset.fileFilter] = fileFilter.value;
      if (state.route === "files") render();
      return;
    }

    const taskFilter = event.target.closest("[data-task-filter]");
    if (!taskFilter) return;

    state.taskFilter[taskFilter.dataset.taskFilter] = taskFilter.value;
    if (state.route === "tasks") render();
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!form.matches("[data-form]")) return;
    event.preventDefault();
    if (form.dataset.form === "business-range") {
      const rangeStart = form.elements.range_start?.value || "";
      const rangeEnd = form.elements.range_end?.value || "";
      state.businessView = { ...state.businessView, rangeStart, rangeEnd };
      if (!BusinessCore.isValidIsoDate(rangeStart) || !BusinessCore.isValidIsoDate(rangeEnd)) {
        state.error = "יש לבחור תאריך התחלה ותאריך סיום תקינים לחישוב הטווח.";
        state.message = "";
      } else if (rangeStart > rangeEnd) {
        state.error = "תאריך ההתחלה חייב להיות לפני תאריך הסיום או שווה לו.";
        state.message = "";
      } else {
        const rangeRecords = BusinessCore.recordsInRange(state.businessRecords, rangeStart, rangeEnd);
        state.businessView = {
          ...state.businessView,
          range: { ...BusinessCore.summarizeRecords(rangeRecords), start: rangeStart, end: rangeEnd, count: rangeRecords.length }
        };
        state.error = "";
        state.message = "";
      }
      render();
      return;
    }
    if (!beginBusyForm(form)) return;
    state.error = "";
    state.message = "";
    setSaveState("saving");

    try {
      if (form.dataset.form === "settings") {
        saveConfig(Object.fromEntries(new FormData(form).entries()));
        await saveRemoteSettings();
        state.message = "ההגדרות נשמרו.";
      }

      if (form.dataset.form === "business-record") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const isEdit = Boolean(form.dataset.id);
        await runAuditedAction(
          {
            actionType: isEdit ? "update" : "create",
            entityType: "business_record",
            entityId: form.dataset.id || "",
            summary: isEdit ? "עדכון רשומת עסק" : "יצירת רשומת עסק",
            undoable: false
          },
          () => saveBusinessRecord(form)
        );
        state.message = isEdit ? "רשומת העסק עודכנה." : "המסמך הועלה והרשומה נשמרה.";
      }

      if (form.dataset.form === "patient") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const patient = await runAuditedAction(
          { actionType: form.dataset.id ? "update" : "create", entityType: "patient", entityId: form.dataset.id || "", summary: form.dataset.id ? "עדכון פרטי מטופל" : "יצירת מטופל", undoable: Boolean(form.dataset.id) },
          () => savePatient(form)
        );
        state.currentPatientId = "";
        if (form.dataset.id) {
          state.message = patient.folderCreated
            ? "פרטי המטופל עודכנו ונוצרה לו תיקייה."
            : "פרטי המטופל עודכנו במערכת.";
        } else {
          state.message = "המטופל נשמר במערכת ונוצרה לו תיקייה.";
        }
      }

      if (form.dataset.form === "contact") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const isEdit = Boolean(form.dataset.id);
        await runAuditedAction(
          { actionType: isEdit ? "update" : "create", entityType: "contact", entityId: form.dataset.id || "", summary: isEdit ? "עדכון איש קשר" : "הוספת איש קשר" },
          () => saveContact(form)
        );
        state.message = isEdit ? "פרטי איש הקשר עודכנו." : "איש הקשר נוסף לכרטיס המטופל.";
      }

      if (form.dataset.form === "goal") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const isEdit = Boolean(form.dataset.id);
        await runAuditedAction(
          { actionType: isEdit ? "update" : "create", entityType: "goal", entityId: form.dataset.id || "", summary: isEdit ? "עדכון מטרת טיפול" : "יצירת מטרת טיפול" },
          () => saveGoal(form)
        );
        state.message = isEdit ? "מטרת הטיפול עודכנה." : "מטרת הטיפול נשמרה.";
      }

      if (form.dataset.form === "questionnaire-template") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await saveQuestionnaireTemplate(form);
        state.message = "תבנית השאלון נשמרה.";
      }

      if (form.dataset.form === "questionnaire-assignment") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני יצירת שאלון.");
        await runAuditedAction(
          { actionType: "create", entityType: "questionnaire", summary: "יצירת שאלון לנמען", undoable: false },
          () => createQuestionnaireAssignment(form)
        );
        state.message = "השאלון נוצר. אפשר לשלוח אותו ב-WhatsApp או במייל.";
      }

      if (form.dataset.form === "clinical-report") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני הפקת דוח.");
        await runAuditedAction(
          { actionType: "create", entityType: "clinical_report", summary: "הפקת דוח טיפולי", undoable: false },
          () => createClinicalReport(form)
        );
        state.message = "הדוח הופק ונשמר כ-Google Doc וכ-PDF בתיק המטופל.";
      }

      if (form.dataset.form === "session") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: form.dataset.id ? "update" : "create", entityType: "session", entityId: form.dataset.id || "", summary: form.dataset.id ? "עדכון מפגש" : "יצירת מפגש", undoable: false },
          () => saveSession(form)
        );
        const syncMessages = [lastCalendarSyncError, lastDocumentSyncError].filter(Boolean);
        state.message = syncMessages.length
          ? `המפגש נשמר במערכת. ${syncMessages.join(" ")}`
          : "המפגש נשמר במערכת, סונכרן ליומן ונוצר לו מסמך תיעוד.";
      }

      if (form.dataset.form === "payment") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: form.dataset.id ? "update" : "create", entityType: "payment", entityId: form.dataset.id || "", summary: form.dataset.id ? "עדכון תשלום" : "יצירת תשלום", undoable: !form.elements.receipt_upload?.files?.[0] },
          () => savePayment(form)
        );
        state.message = "התשלום נשמר במערכת.";
      }

      if (form.dataset.form === "task") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: form.dataset.id ? "update" : "create", entityType: "task", entityId: form.dataset.id || "", summary: form.dataset.id ? "עדכון משימה ותזכורת" : "יצירת משימה ותזכורת" },
          () => saveTask(form)
        );
        state.message = "המשימה נשמרה במערכת.";
      }

      if (form.dataset.form === "schedule-exception") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "create", entityType: "schedule_exception", summary: "יצירת חריג יומן" },
          () => saveScheduleException(form)
        );
        state.message = "חריג היומן נשמר.";
      }

      if (form.dataset.form === "file") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const isEdit = Boolean(form.dataset.id);
        await runAuditedAction(
          { actionType: isEdit ? "update" : "create", entityType: "file", entityId: form.dataset.id || "", summary: isEdit ? "עדכון קובץ" : "העלאת קובץ", undoable: false },
          () => saveFile(form)
        );
        state.message = isEdit ? "פרטי הקובץ עודכנו." : "הקובץ הועלה ונרשם בכרטיס המטופל.";
      }

      if (form.dataset.form === "template-copy") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await runAuditedAction(
          { actionType: "create", entityType: "file", summary: "יצירת מסמך מתבנית", undoable: false },
          () => createFileFromTemplate(form)
        );
        state.message = "המסמך נוצר מתבנית, נשמר בתיקיית המטופל ונרשם בקבצים.";
      }

      setSaveState(state.syncQueue.length ? "pending" : "saved");
      render();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "הפעולה נכשלה.";
      setSaveState(state.syncQueue.length ? "pending" : "error");
      render();
    } finally {
      endBusyForm(form);
    }
  });
}

function render() {
  closePicker();
  state.route = getRoute();
  const [route, idPart] = state.route.split("/");
  const pages = {
    dashboard: dashboardPage,
    patients: () => (idPart ? profilePage(idPart) : patientsPage()),
    calendar: calendarPage,
    tasks: tasksPage,
    payments: paymentsPage,
    business: businessPage,
    reports: reportsPage,
    files: filesPage,
    settings: settingsPage
  };
  const isSettings = route === "settings";
  document.getElementById("app").innerHTML =
    !isSettings && !canUseStorage() ? accessGatePage() : (pages[route] || dashboardPage)();
  scheduleMessageDismiss();
  if (route === "calendar") ensureIsraelHolidaysForMonth(state.calendarMonth).catch(() => {});
  if (route === "patients" && idPart && state.profileTab === "questionnaires" && !state.questionnaireSyncStarted[idPart]) {
    state.questionnaireSyncStarted[idPart] = true;
    syncQuestionnaires(idPart).then((imported) => {
      if (imported) {
        state.message = `נקלטו ${imported} תשובות חדשות.`;
        render();
      }
    }).catch(() => {});
  }
}

function scheduleMessageDismiss() {
  if (!state.message) {
    if (messageDismissTimer) window.clearTimeout(messageDismissTimer);
    messageDismissTimer = null;
    messageDismissValue = "";
    return;
  }

  if (messageDismissTimer && messageDismissValue === state.message) return;

  if (messageDismissTimer) window.clearTimeout(messageDismissTimer);
  messageDismissValue = state.message;
  messageDismissTimer = window.setTimeout(() => {
    if (state.message !== messageDismissValue) return;
    state.message = "";
    messageDismissTimer = null;
    messageDismissValue = "";
    render();
  }, 4500);
}

function busyActionKey(target) {
  const parts = [
    target.dataset.action || "",
    target.dataset.id || "",
    target.dataset.patientId || "",
    target.dataset.table || "",
    target.dataset.status || "",
    target.dataset.tab || "",
    target.dataset.date || ""
  ];
  return parts.join(":");
}

function beginBusyAction(target) {
  const key = busyActionKey(target);
  if (!key || pendingActions.has(key) || target.disabled) return "";
  pendingActions.add(key);
  target.disabled = true;
  target.dataset.busy = "true";
  return key;
}

function endBusyAction(target, key) {
  if (!key) return;
  pendingActions.delete(key);
  if (target.isConnected) {
    target.disabled = false;
    delete target.dataset.busy;
  }
}

function beginBusyForm(form) {
  if (pendingForms.has(form)) return false;
  pendingForms.add(form);
  form.dataset.busy = "true";
  form.querySelectorAll("button").forEach((control) => {
    control.disabled = true;
  });
  return true;
}

function endBusyForm(form) {
  pendingForms.delete(form);
}

window.addEventListener("hashchange", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  processSyncQueue().catch(() => {});
  if (state.accessToken && googleTokenExpiresAt && googleTokenExpiresAt - Date.now() <= 5 * 60_000) {
    connectGoogle(false, true);
    return;
  }
  if (!state.accessToken && localStorage.getItem(GOOGLE_CONSENT_KEY) === "yes") {
    restoreGoogleSession().catch(() => {});
  }
});
window.addEventListener("online", () => processSyncQueue(true).catch(() => {}));
render();
bindEvents();

restoreGoogleSession()
  .then(render)
  .catch((error) => {
    state.authRestoring = false;
    state.error = error instanceof Error ? error.message : "טעינת הנתונים נכשלה.";
    render();
  });
