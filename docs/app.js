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
    "updated_at"
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
  ]
};

const configDefaults = window.CLINIC_MANAGER_CONFIG || {};
const GOOGLE_TOKEN_KEY = "clinic-manager-google-token";
const GOOGLE_CONSENT_KEY = "clinic-manager-google-consent";
const SETTINGS_FILE_NAME = "clinic-manager-settings.json";
const DEFAULT_SESSION_TYPES = ["טיפול", "הדרכת הורים", "שיחה", "אבחון"];
const DEFAULT_SESSION_LOCATIONS = ["קליניקה", "בית ספר", "אונליין", "בית"];
const state = {
  accessToken: loadStoredGoogleToken(),
  config: loadConfig(),
  googleUser: null,
  authChecked: false,
  currentPatientId: "",
  currentSessionId: "",
  currentPaymentId: "",
  currentTaskId: "",
  currentFileId: "",
  message: "",
  error: "",
  patients: [],
  sessions: [],
  payments: [],
  tasks: [],
  files: [],
  templates: [],
  dataHealth: null,
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
    allowedUserEmails: listText(
      saved.allowedUserEmails,
      configDefaults.allowedUserEmails,
      []
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
  state.config = { ...state.config, ...nextConfig };
  localStorage.setItem("clinic-manager-config", JSON.stringify(state.config));
}

function listText(savedValue, defaultValue, fallbackItems) {
  if (Array.isArray(savedValue)) return savedValue.join("\n");
  if (typeof savedValue === "string" && savedValue.trim()) return savedValue;
  if (Array.isArray(defaultValue)) return defaultValue.join("\n");
  if (typeof defaultValue === "string" && defaultValue.trim()) return defaultValue;
  return fallbackItems.join("\n");
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
  if (!allowedEmails.length) return true;
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
    const stored = JSON.parse(
      localStorage.getItem(GOOGLE_TOKEN_KEY) || sessionStorage.getItem(GOOGLE_TOKEN_KEY) || "null"
    );

    if (!stored?.accessToken || !stored?.expiresAt || Date.now() > stored.expiresAt) {
      clearStoredGoogleToken();
      return "";
    }

    return stored.accessToken;
  } catch {
    clearStoredGoogleToken();
    return "";
  }
}

function clearStoredGoogleToken(resetConsent = false) {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
  if (resetConsent) localStorage.removeItem(GOOGLE_CONSENT_KEY);
}

function saveGoogleToken(response) {
  const expiresInSeconds = Number(response.expires_in || 3300);
  const expiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;
  const payload = JSON.stringify({
    accessToken: response.access_token,
    expiresAt
  });

  localStorage.setItem(GOOGLE_TOKEN_KEY, payload);
  sessionStorage.setItem(GOOGLE_TOKEN_KEY, payload);
  localStorage.setItem(GOOGLE_CONSENT_KEY, "yes");
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

function shell(content) {
  const nav = [
    ["dashboard", "dashboard", "דשבורד"],
    ["patients", "patients", "מטופלים"],
    ["calendar", "calendar", "יומן"],
    ["tasks", "tasks", "משימות"],
    ["payments", "payments", "תשלומים"],
    ["reports", "reports", "דוחות"],
    ["files", "files", "קבצים"],
    ["settings", "settings", "הגדרות"]
  ]
    .map(
      ([key, iconName, label]) => `
        <a class="side-link ${activeKey() === key ? "active" : ""}" href="#/${key}">
          <span class="side-glyph">${icon(iconName)}</span>
          <span>${label}</span>
        </a>`
    )
    .join("");

  return `
    <div class="app-shell">
      <aside class="side-nav">
        <div class="side-brand">
          <img class="side-brand-logo" src="./assets/malka-logo.png" alt="מלכה זיידמן" />
          <span>מלכה זיידמן</span>
          <small>ניהול קליניקה</small>
        </div>
        <nav class="side-menu">${nav}</nav>
      </aside>
      <main class="main">
        ${state.error ? `<div class="message error">${html(state.error)}</div>` : ""}
        ${state.message ? `<div class="message">${html(state.message)}</div>` : ""}
        ${content}
      </main>
    </div>`;
}

function connectionBanner() {
  if (state.accessToken) return "";
  return `
    <div class="message">
      יש להתחבר לאחסון כדי לקרוא ולשמור נתונים.
      <button class="button blue" data-action="connect-google" type="button">התחברות לאחסון</button>
    </div>`;
}

function accessGatePage() {
  const allowedEmails = configuredEmails();
  const connectedEmail = state.googleUser?.email || "";
  const subtitle = state.accessToken
    ? "החשבון המחובר נבדק לפני טעינת הנתונים."
    : "יש להתחבר לחשבון Google מורשה כדי לעבוד עם נתוני הקליניקה.";
  const details = state.accessToken && connectedEmail
    ? `מחובר כעת: ${connectedEmail}`
    : allowedEmails.length
      ? `חשבונות מורשים: ${allowedEmails.join(", ")}`
      : "לא הוגדרה רשימת מורשים. אפשר להגדיר אותה במסך ההגדרות.";

  return shell(`
    ${header("כניסה למערכת", subtitle, `<button class="button blue" data-action="connect-google" type="button">התחברות לחשבון מורשה</button>`)}
    <section class="panel">
      <div class="empty">
        <div>
          <strong>${html(details)}</strong>
          <p>הנתונים יוצגו רק אחרי זיהוי חשבון מורשה.</p>
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
  const openTasks = state.tasks.filter((task) => task.status !== "done").length;
  const activePatients = state.patients.filter((patient) => patient.status !== "archived").length;
  const today = isoDate(new Date());
  const todayRows = sessionsForDates([today]);
  const weekRows = sessionsForDates(dateRange(today, 7));
  const todaySessions = todayRows.length;

  return shell(`
    ${header(
      "תמונת מצב יומית",
      "מפגשים, משימות ותשלומים לטיפול.",
      `<button class="button" data-action="open-patient-drawer" type="button">מטופל חדש +</button>`
    )}
    ${connectionBanner()}
    <section class="kpi-grid">
      <article class="kpi-card blue-card"><div><strong>${todaySessions}</strong><span>מפגשים היום</span></div><span class="kpi-symbol">${icon("calendar")}</span></article>
      <article class="kpi-card teal-card"><div><strong>${openTasks}</strong><span>משימות פתוחות</span></div><span class="kpi-symbol">${icon("tasks")}</span></article>
      <article class="kpi-card pink-card"><div><strong>${openPayments}</strong><span>תשלומים פתוחים</span></div><span class="kpi-symbol">${icon("payments")}</span></article>
      <article class="kpi-card purple-card"><div><strong>${activePatients}</strong><span>מטופלים פעילים</span></div><span class="kpi-symbol">${icon("patients")}</span></article>
    </section>
    <section class="dashboard-grid">
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
      "רשימת מטופלים קיימים.",
      `<button class="button" data-action="open-patient-drawer" type="button">הוסף מטופל +</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>
       <a class="button yellow" href="#/settings">הגדרות</a>`
    )}
    ${connectionBanner()}
    <section class="panel">
      <div class="panel-head"><h2>מטופלים קיימים</h2><span>${filteredPatients.length} מתוך ${state.patients.length} רשומות</span></div>
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
              <td><input class="table-filter" placeholder="חיפוש שם" data-patient-filter="name" value="${html(filters.name)}" /></td>
              <td><input class="table-filter" placeholder="מוסד" data-patient-filter="school" value="${html(filters.school)}" /></td>
              <td><input class="table-filter" placeholder="סוג טיפול" data-patient-filter="treatment" value="${html(filters.treatment)}" /></td>
              <td><input class="table-filter" placeholder="סטטוס" data-patient-filter="status" value="${html(filters.status)}" /></td>
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
                      <button class="small-action" data-action="open-profile" data-id="${html(patient.id)}" type="button">↗</button>
                      <button class="small-action edit" data-action="open-patient-drawer" data-id="${html(patient.id)}" type="button">✎</button>
                      <button class="small-action danger" data-action="toggle-patient-archive" data-id="${html(patient.id)}" data-archive="${patient.status === "archived" ? "restore" : "archive"}" type="button" aria-label="${patient.status === "archived" ? "החזרה מארכיון" : "ארכוב"}">${patient.status === "archived" ? "↩" : "↓"}</button>
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
      </section>
    </section>
  `);
}

function profileTabKey() {
  const allowedTabs = ["overview", "documentation", "payments", "tasks", "files"];
  return allowedTabs.includes(state.profileTab) ? state.profileTab : "overview";
}

function profileTabs(activeTab) {
  const tabs = [
    ["overview", "פרטים"],
    ["documentation", "תיעוד מפגש"],
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
      <div class="panel-head"><h2>פרטים כלליים</h2><span>נתוני מטופל</span></div>
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

function settingsPage() {
  return shell(`
    ${header("הגדרות", "חיבור הדפדפן לאחסון. פרטי החיבור נשמרים בדפדפן שלך.", `<button class="button blue" data-action="connect-google" type="button">התחברות לאחסון</button>`)}
    <section class="grid-two">
      <article class="panel">
        <div class="panel-head"><h2>פרטי חיבור</h2><span>נשמר בדפדפן שלך</span></div>
        <form class="form-grid" data-form="settings">
          <div class="field wide">
            <label for="googleClientId">מזהה התחברות</label>
            <input id="googleClientId" name="googleClientId" value="${html(state.config.googleClientId)}" placeholder="xxxx.apps.googleusercontent.com" />
          </div>
          <div class="field wide">
            <label for="googleSpreadsheetId">מזהה מאגר נתונים</label>
            <input id="googleSpreadsheetId" name="googleSpreadsheetId" value="${html(state.config.googleSpreadsheetId)}" />
          </div>
          <div class="field wide">
            <label for="googleDriveRootFolderId">תיקיית אחסון ראשית</label>
            <input id="googleDriveRootFolderId" name="googleDriveRootFolderId" value="${html(state.config.googleDriveRootFolderId)}" />
          </div>
          <div class="field wide">
            <label for="googleTemplatesFolderId">תיקיית תבניות</label>
            <input id="googleTemplatesFolderId" name="googleTemplatesFolderId" value="${html(state.config.googleTemplatesFolderId)}" />
          </div>
          <div class="field wide">
            <label for="googleCalendarId">יומן לסנכרון מפגשים</label>
            <input id="googleCalendarId" name="googleCalendarId" value="${html(state.config.googleCalendarId)}" placeholder="primary" />
          </div>
          <div class="field wide">
            <label for="allowedUserEmails">חשבונות Google מורשים</label>
            <textarea id="allowedUserEmails" name="allowedUserEmails" placeholder="כל שורה היא כתובת אימייל מורשית. אם הרשימה ריקה, כל חשבון Google שמאשר הרשאות יוכל להתחבר.">${html(state.config.allowedUserEmails)}</textarea>
          </div>
          <div class="field wide">
            <label for="sessionTypes">סוגי מפגש</label>
            <textarea id="sessionTypes" name="sessionTypes" placeholder="כל שורה היא אפשרות ברשימה">${html(state.config.sessionTypes)}</textarea>
          </div>
          <div class="field wide">
            <label for="sessionLocations">מיקומים למפגש</label>
            <textarea id="sessionLocations" name="sessionLocations" placeholder="כל שורה היא אפשרות ברשימה">${html(state.config.sessionLocations)}</textarea>
          </div>
          <div class="toolbar wide">
            <button class="button" type="submit">שמירת הגדרות</button>
          </div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>מצב</h2><span>מערכת</span></div>
        <div class="settings-card">
          <p><strong>קוד:</strong> נטען מהאתר.</p>
          <p><strong>נתונים:</strong> נשמרים באחסון המחובר.</p>
          <p><strong>חיבור:</strong> ${state.accessToken ? "מחובר כרגע." : "לא מחובר כרגע."}</p>
          <p><strong>חשבון:</strong> ${state.googleUser?.email ? html(state.googleUser.email) : "לא זוהה עדיין."}</p>
          <p><strong>הרשאה:</strong> ${state.accessToken && state.authChecked ? (isAuthorizedGoogleUser() ? "מורשה." : "לא מורשה.") : "תיבדק אחרי התחברות."}</p>
          <button class="button blue" data-action="check-storage" type="button">בדיקת חיבור</button>
          <button class="button secondary" data-action="force-connect-google" type="button">התחברות מחדש עם הרשאות</button>
          <div class="diagnostic-actions">
            <a class="button yellow" href="${html(googleApiActivationUrl("sheets.googleapis.com"))}" target="_blank" rel="noopener">הפעלת מאגר נתונים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("drive.googleapis.com"))}" target="_blank" rel="noopener">הפעלת אחסון קבצים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("calendar.googleapis.com"))}" target="_blank" rel="noopener">הפעלת יומן</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("docs.googleapis.com"))}" target="_blank" rel="noopener">הפעלת מסמכים</a>
          </div>
          <p class="settings-hint">אם בדיקת החיבור נכשלת, מפעילים את שני הרכיבים, חוזרים לכאן ולוחצים התחברות מחדש עם הרשאות.</p>
        </div>
      </article>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>גיבוי וייצוא</h2><span>שמירת עותק עבודה</span></div>
      <div class="toolbar">
        <button class="button blue" data-action="download-backup" type="button">הורדת גיבוי מלא</button>
        <button class="button" data-action="save-backup-drive" type="button">שמירת גיבוי באחסון</button>
        <button class="button secondary" data-action="export-table" data-table="patients" type="button">ייצוא מטופלים</button>
        <button class="button secondary" data-action="export-table" data-table="payments" type="button">ייצוא תשלומים</button>
        <button class="button secondary" data-action="export-table" data-table="tasks" type="button">ייצוא משימות</button>
      </div>
      <div class="restore-box">
        <label class="field">
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
        ${detail("תאריך גיבוי", formatDate(isoDate(new Date())))}
      </div>
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>בדיקת תקינות נתונים</h2><span>גיליונות ועמודות</span></div>
      <div class="toolbar">
        <button class="button blue" data-action="check-data-health" type="button">בדיקת תקינות</button>
        <button class="button yellow" data-action="repair-data-health" type="button">תיקון מבנה</button>
      </div>
      ${dataHealthView()}
    </section>
  `);
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
  const sessionOptions = state.sessions
    .filter((session) => session.patient_id === patientId)
    .sort((a, b) =>
      `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
    )
    .map(
      (session) =>
        `<option value="${html(session.id)}" ${session.id === editedPayment?.session_id ? "selected" : ""}>${html(sessionLabel(session))}</option>`
    )
    .join("");
  const receiptFile = editedPayment?.receipt_file_id
    ? state.files.find((file) => file.drive_file_id === editedPayment.receipt_file_id)
    : null;
  return `
    <form class="form-grid inline-form" data-form="payment" data-patient-id="${html(patientId)}" data-id="${html(editedPayment?.id || "")}">
      <div class="field wide">
        <label for="payment_session_id">מפגש קשור</label>
        <select id="payment_session_id" name="session_id">
          <option value="">ללא שיוך למפגש</option>
          ${sessionOptions}
        </select>
      </div>
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
      <div class="panel-head"><h2>${patientMode ? "תיעוד מפגש" : "מפגשים קרובים"}</h2><span>${patientMode ? "כתיבה והקלטה בתוך הכרטיס" : "היום והשבוע הקרוב"}</span></div>
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

function paymentsPanel(items = state.payments, patientId = "") {
  const rows = items.slice(0, 5);
  return `
    <article class="panel">
      <div class="panel-head"><h2>תשלומים</h2><span>מעקב גבייה</span></div>
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
  const sessionsByDate = rows.reduce((acc, session) => {
    if (!session.session_date) return acc;
    acc[session.session_date] = [...(acc[session.session_date] || []), session];
    return acc;
  }, {});
  const weekDays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  return shell(`
    ${header(
      "יומן",
      "לוח שנה פעיל של מפגשים.",
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
              return `
                <button class="calendar-day ${day.inMonth ? "" : "muted"} ${day.date === today ? "today" : ""} ${day.date === state.selectedCalendarDate ? "selected" : ""}" data-action="select-calendar-date" data-date="${html(day.date)}" type="button">
                  <span class="day-number">${Number(day.date.slice(8, 10))}</span>
                  <span class="day-events">
                    ${daySessions
                      .slice(0, 1)
                      .map(
                        (session) =>
                          `<span class="calendar-event">${html(session.start_time || "")} ${html(patientName(session.patient_id))}</span>`
                      )
                      .join("")}
                    ${
                      daySessions.length > 3
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
          <span>${selectedSessions.length} מפגשים</span>
        </div>
        ${
          selectedSessions.length
            ? `<div class="item-list">${selectedSessions
                .map(
                  (session) => `
                  <article class="list-item calendar-list-item">
                    <div><strong>${html([session.start_time, session.end_time].filter(Boolean).join("-") || "ללא שעה")}</strong><span>${html(session.location || "-")}</span></div>
                    <div><strong>${html(patientName(session.patient_id))}</strong><span>${html(session.session_type || "מפגש")}${session.is_recurring ? ` <span class="status-pill muted">קבוע</span>` : ""}</span></div>
                    <p>${html(session.summary || "לא נכתב סיכום.")}</p>
                    <div class="row-actions">
                      ${
                        session.is_recurring
                          ? `<button class="button blue table-button" data-action="materialize-recurring" data-patient-id="${html(session.patient_id)}" data-date="${html(session.session_date)}" type="button">שמירה</button>`
                          : ""
                      }
                      <button class="button secondary table-button" data-action="open-profile" data-id="${html(session.patient_id)}" type="button">כרטיס</button>
                    </div>
                  </article>`
                )
                .join("")}</div>`
            : `<div class="empty">אין מפגשים ביום הזה. אפשר להוסיף מפגש מתוך כרטיס מטופל.</div>`
        }
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
  const openTotal = rows
    .filter((payment) => payment.payment_status !== "paid")
    .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const receiptNeeded = rows.filter((payment) => payment.receipt_status !== "issued").length;

  return shell(`
    ${header(
      "תשלומים",
      "מעקב גבייה, תשלומים וקבלות.",
      `<button class="button secondary" data-action="refresh" type="button">רענון</button>
       <button class="button blue" data-action="export-receipts" type="button">ייצוא קבלות להכנה</button>
       <a class="button yellow" href="#/patients">פתיחת מטופלים</a>`
    )}
    ${connectionBanner()}
    <section class="metric-row">
      <article class="metric blue-card"><strong>${html(formatAmount(paidTotal))}</strong><span>שולם</span></article>
      <article class="metric pink-card"><strong>${html(formatAmount(openTotal))}</strong><span>פתוח</span></article>
      <article class="metric teal-card"><strong>${receiptsToPrepare.length}</strong><span>קבלות להכנה</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>רשימת תשלומים</h2><span>${rows.length} רשומות</span></div>
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
      "דוחות",
      `סיכום עבודה לחודש ${monthLabel(month)} מתוך נתוני המערכת.`,
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
    <section class="grid-two">
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
    <section class="grid-two page-gap">
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
            <th>יעד</th>
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
                <td>${html(formatDate(task.due_date))}</td>
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
      "ניהול מעקבים, תזכורות ופעולות המשך.",
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
      <div class="panel-head"><h2>משימה חדשה</h2><span>נשמרת במערכת</span></div>
      ${taskForm()}
    </section>
    ${taskFiltersPanel(rows.length, shownRows.length)}
    <section class="panel page-gap">
      <div class="panel-head"><h2>רשימת משימות</h2><span>${shownRows.length} רשומות</span></div>
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
      <div class="panel-head"><h2>קבצים</h2><span>אחסון</span></div>
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
      "קבצים שמורים לפי מטופל.",
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
      <div class="panel-head"><h2>${state.currentFileId ? "עריכת קובץ" : "קובץ חדש"}</h2><span>העלאה לתיקיית המטופל</span></div>
      ${fileForm()}
    </section>
    ${fileFiltersPanel(rows.length, shownRows.length)}
    <section class="panel page-gap">
      <div class="panel-head"><h2>רשימת קבצים</h2><span>${shownRows.length} רשומות</span></div>
      ${filesTable(shownRows)}
    </section>
  `);
}

function patientDrawer() {
  const patient = state.currentPatientId
    ? state.patients.find((item) => item.id === state.currentPatientId)
    : null;
  const title = patient ? "עריכת מטופל" : "הוספת מטופל";
  const submitLabel = patient ? "שמירת שינויים" : "שמירה";

  return `
    <section class="drawer" id="patientDrawer" hidden>
      <div class="drawer-inner">
        <div class="panel-head">
          <h2>${title}</h2>
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

function fixedTimeOptions(selectedValue = "") {
  const options = [`<option value="">בחירה</option>`];

  for (let hour = 7; hour <= 22; hour += 1) {
    for (const minute of ["00", "15", "30", "45"]) {
      if (hour === 22 && minute !== "00") continue;
      const value = `${String(hour).padStart(2, "0")}:${minute}`;
      options.push(
        `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`
      );
    }
  }

  if (selectedValue && !options.some((option) => option.includes(`value="${html(selectedValue)}"`))) {
    options.push(`<option value="${html(selectedValue)}" selected>${html(selectedValue)}</option>`);
  }

  return options.join("");
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

function recurringSessionForDate(patient, dateValue) {
  if (!patient?.id || patient.status === "archived") return null;
  if (!patient.fixed_day || !patient.fixed_time) return null;
  const date = dateFromInput(dateValue);
  if (fixedDayIndex(patient.fixed_day) !== date.getDay()) return null;
  if (actualSessionExists(patient.id, dateValue)) return null;

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
  } catch (error) {
    lastCalendarSyncError = error instanceof Error ? error.message : "סנכרון היומן נכשל.";
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
  } catch (error) {
    lastDocumentSyncError = error instanceof Error ? error.message : "יצירת מסמך התיעוד נכשל.";
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

async function connectGoogle(forceConsent = false) {
  state.error = "";
  state.message = "";
  if (forceConsent) {
    clearStoredGoogleToken(true);
    state.accessToken = "";
  }

  if (!state.config.googleClientId) {
    state.error = "צריך להכניס מזהה התחברות במסך ההגדרות.";
    navigate("settings");
    render();
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    state.error = "רכיב ההתחברות עדיין לא נטען. נסו שוב בעוד רגע.";
    render();
    return;
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.googleClientId,
    scope:
      "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/documents",
    callback: async (response) => {
      if (response.error) {
        state.error = "ההתחברות לאחסון נכשלה.";
        render();
        return;
      }

      state.accessToken = response.access_token;
      saveGoogleToken(response);
      try {
        await loadGoogleUser();
        await loadData();
        state.error = "";
      } catch (error) {
        state.error = error instanceof Error ? error.message : "בדיקת ההרשאה נכשלה.";
      }
      render();
    }
  });

  tokenClient.requestAccessToken({
    prompt: forceConsent || localStorage.getItem(GOOGLE_CONSENT_KEY) !== "yes" ? "consent" : ""
  });
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

  if (status === 401 || combined.includes("invalid credentials")) {
    clearStoredGoogleToken();
    state.accessToken = "";
    state.googleUser = null;
    state.authChecked = false;
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
    return "חסרה הרשאה לאחסון קבצים. צריך להתחבר שוב ולאשר את כל ההרשאות המבוקשות.";
  }

  return message || "הקריאה לאחסון נכשלה.";
}

async function googleFetch(url, options = {}) {
  if (!state.accessToken) throw new Error("לא מחוברים לאחסון.");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(friendlyGoogleError(text, response.status));
  }

  return response.status === 204 ? null : response.json();
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
  state.googleUser = {
    email: profile?.email || "",
    name: profile?.name || ""
  };
  state.authChecked = true;

  if (!isAuthorizedGoogleUser()) {
    state.patients = [];
    state.sessions = [];
    state.payments = [];
    state.tasks = [];
    state.files = [];
    state.templates = [];
    throw new Error("החשבון המחובר לא מורשה להשתמש במערכת הזו.");
  }

  return state.googleUser;
}

async function readSheet(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  if (!spreadsheetId) return [];
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A2:${String.fromCharCode(64 + columns.length)}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const result = await googleFetch(url);
  return (result.values || [])
    .map((row, index) => ({ ...rowToRecord(columns, row), _rowNumber: String(index + 2) }))
    .filter((record) => columns.some((column) => record[column]));
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
  const range = `${sheetName}!A1:${String.fromCharCode(64 + columns.length)}1`;
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
      await writeSheetHeader(sheet);
      header = await readSheetHeader(sheet).catch(() => []);
      row = healthRow(sheet, existingSheets, header);
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

async function appendSheet(sheetName, record) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A:${String.fromCharCode(64 + columns.length)}`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append`
  );
  url.searchParams.set("valueInputOption", "RAW");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  return googleFetch(url.toString(), {
    method: "POST",
    body: JSON.stringify({ values: [recordToRow(columns, record)] })
  });
}

function appendedRowNumber(result) {
  const range = result?.updates?.updatedRange || "";
  return range.match(/![A-Z]+(\d+):/)?.[1] || "";
}

async function updateSheetRow(sheetName, rowNumber, record) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A${rowNumber}:${String.fromCharCode(64 + columns.length)}${rowNumber}`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  url.searchParams.set("valueInputOption", "RAW");
  await googleFetch(url.toString(), {
    method: "PUT",
    body: JSON.stringify({ values: [recordToRow(columns, record)] })
  });
}

async function clearSheetRow(sheetName, rowNumber) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A${rowNumber}:${String.fromCharCode(64 + columns.length)}${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;
  await googleFetch(url, {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function checkStorageConnection() {
  if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני בדיקה.");
  if (!state.config.googleSpreadsheetId) throw new Error("לא הוגדר מזהה מאגר נתונים.");
  if (!state.config.googleDriveRootFolderId) throw new Error("לא הוגדרה תיקיית אחסון ראשית.");

  await readSheet("patients");

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

async function createCalendarEvent(session) {
  if (!session.session_date || !session.start_time) return "";
  const calendarId = state.config.googleCalendarId || "primary";
  const endTime = session.end_time || addMinutes(session.start_time, 50);
  const patient = patientName(session.patient_id);
  const body = {
    summary: `${session.session_type || "מפגש"} - ${patient}`,
    location: session.location || "",
    description: session.summary || "",
    start: {
      dateTime: calendarDateTime(session.session_date, session.start_time),
      timeZone: "Asia/Jerusalem"
    },
    end: {
      dateTime: calendarDateTime(session.session_date, endTime),
      timeZone: "Asia/Jerusalem"
    }
  };
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
  const endTime = session.end_time || addMinutes(session.start_time, 50);
  const patient = patientName(session.patient_id);
  const body = {
    summary: `${session.session_type || "מפגש"} - ${patient}`,
    location: session.location || "",
    description: session.summary || "",
    start: {
      dateTime: calendarDateTime(session.session_date, session.start_time),
      timeZone: "Asia/Jerusalem"
    },
    end: {
      dateTime: calendarDateTime(session.session_date, endTime),
      timeZone: "Asia/Jerusalem"
    }
  };
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
      method: "DELETE"
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
  const boundary = `clinic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = {
    name: fileName || selectedFile.name,
    parents: [folderId]
  };
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata
      )}\r\n`,
      `--${boundary}\r\nContent-Type: ${
        selectedFile.type || "application/octet-stream"
      }\r\n\r\n`,
      selectedFile,
      `\r\n--${boundary}--`
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.accessToken}`
      },
      body
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(friendlyGoogleError(text, response.status));
  }

  return response.json();
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
    await updateSheetRow("payments", payment._rowNumber, updated);
    state.payments = state.payments.map((item) => (item.id === payment.id ? updated : item));
  }

  const linkedSessions = state.sessions.filter((session) => session.document_file_id === oldDriveFileId);
  for (const session of linkedSessions) {
    if (!session._rowNumber) continue;
    const updated = {
      ...session,
      document_file_id: newDriveFileId,
      updated_at: now
    };
    await updateSheetRow("sessions", session._rowNumber, updated);
    state.sessions = state.sessions.map((item) => (item.id === session.id ? updated : item));
  }
}

async function deleteFileRecord(fileId) {
  const file = state.files.find((item) => item.id === fileId);
  if (!file) throw new Error("הקובץ לא נמצא.");
  if (!file._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת הקובץ.");

  if (file.drive_file_id) {
    await updateLinkedFileReferences(file.drive_file_id, "");
    await trashDriveFile(file.drive_file_id);
  }
  await clearSheetRow("files", file._rowNumber);
  state.files = state.files.filter((item) => item.id !== fileId);
  if (state.currentFileId === fileId) state.currentFileId = "";
}

async function ensurePatientDriveFolder(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error("המטופל לא נמצא.");
  if (patient.drive_folder_id) return patient;
  if (!patient._rowNumber) throw new Error("צריך לרענן נתונים לפני יצירת תיקייה למטופל הזה.");

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
  if (!state.config.googleSpreadsheetId) return;
  const [patients, sessions, payments, tasks, files, templates] = await Promise.all([
    readSheet("patients"),
    readSheet("sessions"),
    readSheet("payments"),
    readSheet("tasks"),
    readSheet("files"),
    loadDriveTemplates().catch(() => [])
  ]);
  state.patients = patients.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || "", "he"));
  state.sessions = sessions.sort((a, b) => `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`));
  state.payments = payments.sort((a, b) => `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`));
  state.tasks = tasks.sort((a, b) => `${a.due_date || "9999-99-99"} ${a.created_at}`.localeCompare(`${b.due_date || "9999-99-99"} ${b.created_at}`));
  state.files = files.sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
  state.templates = templates.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
}

async function savePatient(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const existingId = form.dataset.id || "";
  const existing = existingId ? state.patients.find((patient) => patient.id === existingId) : null;
  if (!data.child_name) throw new Error("שם המטופל הוא שדה חובה.");

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
  } catch (error) {
    lastCalendarSyncError =
      error instanceof Error ? error.message : "סנכרון היומן נכשל.";
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

  try {
    const documentFileId = await updateSessionDocument(patientId, session);
    if (documentFileId && documentFileId !== session.document_file_id) {
      session.document_file_id = documentFileId;
      if (session._rowNumber) await updateSheetRow("sessions", session._rowNumber, session);
      state.sessions = state.sessions.map((item) => (item.id === session.id ? session : item));
    }
  } catch (error) {
    lastDocumentSyncError =
      error instanceof Error ? error.message : "יצירת מסמך התיעוד נכשלה.";
  }

  state.sessions = state.sessions.sort((a, b) =>
    `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
  );
  state.currentSessionId = "";

  if (!session.summary?.trim()) {
    await createSystemTask(patientId, "השלמת תיעוד מפגש", `מפגש מתאריך ${formatDate(session.session_date)} נשמר ללא סיכום.`, session.session_date);
  }
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

  if (session.calendar_event_id) {
    try {
      await deleteCalendarEvent(session.calendar_event_id);
    } catch (error) {
      lastCalendarSyncError =
        error instanceof Error ? error.message : "מחיקת האירוע מהיומן נכשלה.";
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
  await clearSheetRow("sessions", session._rowNumber);
  state.sessions = state.sessions.filter((item) => item.id !== sessionId);
  if (state.currentSessionId === sessionId) state.currentSessionId = "";
}

async function savePayment(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";
  const existingId = form.dataset.id || "";
  const existingPayment = existingId ? state.payments.find((payment) => payment.id === existingId) : null;
  const receiptUpload = form.elements.receipt_upload?.files?.[0];

  if (!patientId) throw new Error("לא נמצא מטופל לשמירת התשלום.");
  if (!data.amount) throw new Error("סכום התשלום הוא שדה חובה.");
  if (existingId && !existingPayment) throw new Error("התשלום לעריכה לא נמצא.");
  if (existingPayment && !existingPayment._rowNumber) throw new Error("צריך לרענן נתונים לפני עריכת התשלום.");

  const now = new Date().toISOString();
  const receiptFile = receiptUpload
    ? await uploadPatientFile(patientId, receiptUpload, "receipt", receiptUpload.name)
    : null;
  if (receiptFile && existingPayment?.receipt_file_id) {
    await deleteFileRecordByDriveId(existingPayment.receipt_file_id);
  }
  const payment = {
    ...(existingPayment || {}),
    id: existingPayment?.id || id(),
    patient_id: patientId,
    session_id: data.session_id || "",
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
    state.payments = state.payments.map((item) => (item.id === payment.id ? payment : item));
  } else {
    const appendResult = await appendSheet("payments", payment);
    payment._rowNumber = appendedRowNumber(appendResult);
    state.payments = [payment, ...state.payments];
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

  if (payment.receipt_file_id) await deleteFileRecordByDriveId(payment.receipt_file_id);
  await clearSheetRow("payments", payment._rowNumber);
  state.payments = state.payments.filter((item) => item.id !== paymentId);
  if (state.currentPaymentId === paymentId) state.currentPaymentId = "";
}

async function deletePaymentReceipt(paymentId) {
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error("התשלום לא נמצא.");
  if (!payment._rowNumber) throw new Error("צריך לרענן נתונים לפני עדכון התשלום.");
  if (!payment.receipt_file_id) return;

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
    version: "browser-storage-v1",
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
      files: state.files.length
    },
    data: {
      patients: state.patients,
      sessions: state.sessions,
      payments: state.payments,
      tasks: state.tasks,
      files: state.files
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
  return rows.map(({ _rowNumber, ...record }) => record);
}

async function clearSheetData(sheetName) {
  const spreadsheetId = state.config.googleSpreadsheetId;
  const columns = SHEETS[sheetName];
  const range = `${sheetName}!A2:${String.fromCharCode(64 + columns.length)}`;
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
  if (payload?.app !== "clinic-manager" || !payload?.data) {
    throw new Error("קובץ הגיבוי לא מתאים למערכת.");
  }

  await saveBackupToDrive().catch(() => {});
  for (const tableName of Object.keys(SHEETS)) {
    await replaceSheetData(tableName, backupRows(payload, tableName));
  }
  await loadData();
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
    updated_at: now
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
    updated_at: now
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

  await clearSheetRow("tasks", task._rowNumber);
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
    await clearSheetRow("files", existingFile._rowNumber);
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
    if (action === "connect-google") await connectGoogle();
    if (action === "force-connect-google") await connectGoogle(true);
    if (action === "refresh") {
      await loadData().catch((error) => {
        state.error = error.message;
      });
      render();
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
      state.currentPatientId = target.dataset.id || "";
      render();
      document.getElementById("patientDrawer")?.removeAttribute("hidden");
    }
    if (action === "close-drawer") {
      state.currentPatientId = "";
      document.getElementById("patientDrawer")?.setAttribute("hidden", "");
    }
    if (action === "open-profile") {
      state.profileTab = "overview";
      state.currentSessionId = "";
      state.currentPaymentId = "";
      state.currentTaskId = "";
      state.currentFileId = "";
      navigate(`patients/${target.dataset.id}`);
    }
    if (action === "profile-tab") {
      state.profileTab = target.dataset.tab || "overview";
      if (state.profileTab !== "documentation") state.currentSessionId = "";
      if (state.profileTab !== "payments") state.currentPaymentId = "";
      if (state.profileTab !== "tasks") state.currentTaskId = "";
      if (state.profileTab !== "files") state.currentFileId = "";
      render();
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
    if (action === "delete-payment") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את התשלום?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await deletePaymentRecord(target.dataset.id);
        state.message = "התשלום נמחק מהמערכת.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת התשלום נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-payment-receipt") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את קובץ הקבלה?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await deletePaymentReceipt(target.dataset.id);
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
        await setPaymentStatus(target.dataset.id, target.dataset.status || "unpaid");
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
        await setReceiptStatus(target.dataset.id, target.dataset.status || "issued");
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
    if (action === "delete-task") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את המשימה?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        await deleteTaskRecord(target.dataset.id);
        state.message = "המשימה נמחקה.";
        state.error = "";
        render();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "מחיקת המשימה נכשלה.";
        state.message = "";
        render();
      }
    }
    if (action === "delete-session") {
      if (!window.confirm("האם את בטוחה שאת רוצה למחוק את המפגש?")) return;
      try {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני מחיקה.");
        lastCalendarSyncError = "";
        await deleteSessionRecord(target.dataset.id);
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
        await togglePatientArchive(target.dataset.id, shouldArchive);
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
        await materializeRecurringSession(target.dataset.patientId, target.dataset.date);
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
        await ensurePatientDriveFolder(target.dataset.id);
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
        const count = await syncPatientDriveFiles(target.dataset.id);
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
        const draft = await createRecordingTranscriptDraft(target.dataset.id);
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
        await deleteFileRecord(target.dataset.id);
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
        await completeTask(target.dataset.id);
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
    if (!beginBusyForm(form)) return;
    state.error = "";
    state.message = "";

    try {
      if (form.dataset.form === "settings") {
        saveConfig(Object.fromEntries(new FormData(form).entries()));
        await saveRemoteSettings();
        state.message = "ההגדרות נשמרו.";
      }

      if (form.dataset.form === "patient") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const patient = await savePatient(form);
        state.currentPatientId = "";
        if (form.dataset.id) {
          state.message = patient.folderCreated
            ? "פרטי המטופל עודכנו ונוצרה לו תיקייה."
            : "פרטי המטופל עודכנו במערכת.";
        } else {
          state.message = "המטופל נשמר במערכת ונוצרה לו תיקייה.";
        }
      }

      if (form.dataset.form === "session") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await saveSession(form);
        const syncMessages = [lastCalendarSyncError, lastDocumentSyncError].filter(Boolean);
        state.message = syncMessages.length
          ? `המפגש נשמר במערכת. ${syncMessages.join(" ")}`
          : "המפגש נשמר במערכת, סונכרן ליומן ונוצר לו מסמך תיעוד.";
      }

      if (form.dataset.form === "payment") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await savePayment(form);
        state.message = "התשלום נשמר במערכת.";
      }

      if (form.dataset.form === "task") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await saveTask(form);
        state.message = "המשימה נשמרה במערכת.";
      }

      if (form.dataset.form === "file") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        const isEdit = Boolean(form.dataset.id);
        await saveFile(form);
        state.message = isEdit ? "פרטי הקובץ עודכנו." : "הקובץ הועלה ונרשם בכרטיס המטופל.";
      }

      if (form.dataset.form === "template-copy") {
        if (!state.accessToken) throw new Error("צריך להתחבר לאחסון לפני שמירה.");
        await createFileFromTemplate(form);
        state.message = "המסמך נוצר מתבנית, נשמר בתיקיית המטופל ונרשם בקבצים.";
      }

      render();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "הפעולה נכשלה.";
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
    reports: reportsPage,
    files: filesPage,
    settings: settingsPage
  };
  const isSettings = route === "settings";
  document.getElementById("app").innerHTML =
    !isSettings && !canUseStorage() ? accessGatePage() : (pages[route] || dashboardPage)();
  scheduleMessageDismiss();
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
render();
bindEvents();

if (state.accessToken) {
  loadData()
    .then(render)
    .catch((error) => {
      state.error =
        error instanceof Error ? error.message : "טעינת הנתונים נכשלה.";
      render();
    });
}
