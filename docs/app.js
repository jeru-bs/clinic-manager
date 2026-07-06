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
    "updated_at"
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
const state = {
  accessToken: loadStoredGoogleToken(),
  config: loadConfig(),
  currentPatientId: "",
  message: "",
  error: "",
  patients: [],
  sessions: [],
  payments: [],
  tasks: [],
  files: [],
  templates: [],
  patientFilter: {
    name: "",
    school: "",
    treatment: "",
    status: ""
  },
  profileTab: "overview",
  calendarMonth: isoDate(new Date()).slice(0, 7),
  selectedCalendarDate: isoDate(new Date()),
  reportMonth: isoDate(new Date()).slice(0, 7),
  route: getRoute()
};

let messageDismissTimer = null;
let messageDismissValue = "";
let activeRecorder = null;
let activeRecordingPatientId = "";
let activeRecordingStream = null;
let activeRecordingChunks = [];
let activePickerElement = null;

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
    googleSpreadsheetId:
      saved.googleSpreadsheetId || configDefaults.googleSpreadsheetId || ""
  };
}

function saveConfig(nextConfig) {
  state.config = { ...state.config, ...nextConfig };
  localStorage.setItem("clinic-manager-config", JSON.stringify(state.config));
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
  const todaySessions = state.sessions.filter((session) => session.session_date === today).length;

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
      ${sessionsPanel()}
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
          <button class="button blue" data-action="check-storage" type="button">בדיקת חיבור</button>
          <button class="button secondary" data-action="force-connect-google" type="button">התחברות מחדש עם הרשאות</button>
          <div class="diagnostic-actions">
            <a class="button yellow" href="${html(googleApiActivationUrl("sheets.googleapis.com"))}" target="_blank" rel="noopener">הפעלת מאגר נתונים</a>
            <a class="button yellow" href="${html(googleApiActivationUrl("drive.googleapis.com"))}" target="_blank" rel="noopener">הפעלת אחסון קבצים</a>
          </div>
          <p class="settings-hint">אם בדיקת החיבור נכשלת, מפעילים את שני הרכיבים, חוזרים לכאן ולוחצים התחברות מחדש עם הרשאות.</p>
        </div>
      </article>
    </section>
  `);
}

function placeholderPage(title) {
  return shell(`${header(title, "המסך הזה יתחבר לנתוני המערכת בשלב הבא.", `<button class="button secondary" data-action="refresh" type="button">רענון</button>`)}<section class="panel"><div class="empty">בקרוב.</div></section>`);
}

function detail(label, value) {
  return `<div class="detail"><span>${html(label)}</span><strong>${html(value || "-")}</strong></div>`;
}

function sessionForm(patientId) {
  const today = isoDate(new Date());
  return `
    <form class="form-grid inline-form" data-form="session" data-patient-id="${html(patientId)}">
      <div class="field">
        <label for="session_date">תאריך מפגש</label>
        <input class="picker-input" data-date-input id="session_date" name="session_date" readonly required type="text" value="${today}" />
      </div>
      <div class="field">
        <label for="start_time">שעת התחלה</label>
        <input class="picker-input" data-time-input id="start_time" name="start_time" readonly type="text" />
      </div>
      <div class="field">
        <label for="end_time">שעת סיום</label>
        <input class="picker-input" data-time-input id="end_time" name="end_time" readonly type="text" />
      </div>
      <div class="field">
        <label for="session_type">סוג מפגש</label>
        <input id="session_type" name="session_type" placeholder="טיפול / הדרכה / שיחה" />
      </div>
      <div class="field wide">
        <label for="location">מיקום</label>
        <input id="location" name="location" placeholder="קליניקה / בית ספר / אונליין" />
      </div>
      <div class="field wide">
        <label for="summary">תיעוד טיפול</label>
        <textarea class="treatment-textarea" id="summary" name="summary" placeholder="כתיבה חופשית של תיעוד המפגש"></textarea>
      </div>
      <div class="field wide">
        <label for="sensitive_notes">הערות פנימיות</label>
        <textarea id="sensitive_notes" name="sensitive_notes" placeholder="מידע פנימי שאינו מיועד לשיתוף"></textarea>
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">שמירת מפגש</button>
      </div>
    </form>`;
}

function paymentForm(patientId) {
  const today = isoDate(new Date());
  return `
    <form class="form-grid inline-form" data-form="payment" data-patient-id="${html(patientId)}">
      <div class="field">
        <label for="amount">סכום</label>
        <input id="amount" name="amount" inputmode="decimal" required />
      </div>
      <div class="field">
        <label for="paid_at">תאריך</label>
        <input class="picker-input" data-date-input id="paid_at" name="paid_at" readonly type="text" value="${today}" />
      </div>
      <div class="field">
        <label for="payment_method">אמצעי תשלום</label>
        <select id="payment_method" name="payment_method">
          <option value="bank_transfer">העברה בנקאית</option>
          <option value="cash">מזומן</option>
          <option value="bit">ביט</option>
          <option value="credit">אשראי</option>
        </select>
      </div>
      <div class="field">
        <label for="payment_status">סטטוס</label>
        <select id="payment_status" name="payment_status">
          <option value="paid">שולם</option>
          <option value="unpaid">פתוח</option>
          <option value="partial">חלקי</option>
        </select>
      </div>
      <div class="field">
        <label for="receipt_status">קבלה</label>
        <select id="receipt_status" name="receipt_status">
          <option value="needed">דרושה קבלה</option>
          <option value="issued">הופקה קבלה</option>
          <option value="not_needed">לא נדרש</option>
        </select>
      </div>
      <div class="field wide">
        <label for="payment_notes">הערות</label>
        <textarea id="payment_notes" name="notes"></textarea>
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">שמירת תשלום</button>
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
                    <p>${html(payment.notes || paymentStatusLabel(payment.payment_status))}</p>
                  </article>`
              )
              .join("")}</div>`
          : `<div class="empty">עדיין אין תשלומים להצגה.</div>`
      }
    </article>`;
}

function calendarPage() {
  const rows = [...state.sessions].sort((a, b) =>
    `${a.session_date} ${a.start_time}`.localeCompare(`${b.session_date} ${b.start_time}`)
  );
  const today = isoDate(new Date());
  const days = calendarDays(state.calendarMonth);
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
                    <div><strong>${html(patientName(session.patient_id))}</strong><span>${html(session.session_type || "מפגש")}</span></div>
                    <p>${html(session.summary || "לא נכתב סיכום.")}</p>
                    <button class="button secondary table-button" data-action="open-profile" data-id="${html(session.patient_id)}" type="button">כרטיס</button>
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
       <a class="button yellow" href="#/patients">פתיחת מטופלים</a>`
    )}
    ${connectionBanner()}
    <section class="metric-row">
      <article class="metric blue-card"><strong>${html(formatAmount(paidTotal))}</strong><span>שולם</span></article>
      <article class="metric pink-card"><strong>${html(formatAmount(openTotal))}</strong><span>פתוח</span></article>
      <article class="metric teal-card"><strong>${receiptNeeded}</strong><span>קבלות לבדיקה</span></article>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>רשימת תשלומים</h2><span>${rows.length} רשומות</span></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>תאריך</th>
              <th>מטופל</th>
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
                  <td>${html(formatAmount(payment.amount))}</td>
                  <td>${html(paymentMethodLabel(payment.payment_method))}</td>
                  <td><span class="status-pill">${html(paymentStatusLabel(payment.payment_status))}</span></td>
                  <td>${html(receiptStatusLabel(payment.receipt_status))}</td>
                  <td>${html(payment.notes || "-")}</td>
                  <td><button class="button secondary table-button" data-action="open-profile" data-id="${html(payment.patient_id)}" type="button">כרטיס</button></td>
                </tr>`
              )
              .join("") || `<tr><td colspan="8"><div class="empty">אין תשלומים להצגה. אפשר להוסיף תשלום מתוך כרטיס מטופל.</div></td></tr>`}
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
  const paidTotal = monthPayments
    .filter((payment) => payment.payment_status === "paid")
    .reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const openPayments = state.payments.filter((payment) => payment.payment_status !== "paid");
  const openTotal = openPayments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
  const missingReceipts = state.payments.filter(
    (payment) => payment.payment_status === "paid" && payment.receipt_status !== "issued"
  );

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
      <article class="metric purple-card"><strong>${missingReceipts.length}</strong><span>קבלות חסרות</span></article>
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
  return `
    <form class="form-grid inline-form" data-form="task" data-patient-id="${html(patientId)}">
      ${
        patientId
          ? ""
          : `<div class="field">
              <label for="task_patient_id">מטופל</label>
              <select id="task_patient_id" name="patient_id" required>
                <option value="">בחירה</option>
                ${patientOptions()}
              </select>
            </div>`
      }
      <div class="field">
        <label for="task_title">משימה</label>
        <input id="task_title" name="title" required placeholder="למשל: לשלוח סיכום להורה" />
      </div>
      <div class="field">
        <label for="task_due_date">תאריך יעד</label>
        <input class="picker-input" data-date-input id="task_due_date" name="due_date" readonly type="text" />
      </div>
      <div class="field">
        <label for="task_status">סטטוס</label>
        <select id="task_status" name="status">
          <option value="open">פתוחה</option>
          <option value="waiting">בהמתנה</option>
          <option value="done">בוצעה</option>
        </select>
      </div>
      <div class="field wide">
        <label for="task_description">פירוט</label>
        <textarea id="task_description" name="description"></textarea>
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">שמירת משימה</button>
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
                    ${
                      task.status === "done"
                        ? ""
                        : `<button class="button table-button" data-action="complete-task" data-id="${html(task.id)}" type="button">בוצע</button>`
                    }
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

function tasksPage() {
  const rows = [...state.tasks].sort((a, b) =>
    `${a.status === "done" ? "1" : "0"} ${a.due_date || "9999-99-99"}`.localeCompare(
      `${b.status === "done" ? "1" : "0"} ${b.due_date || "9999-99-99"}`
    )
  );
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
    <section class="panel page-gap">
      <div class="panel-head"><h2>רשימת משימות</h2><span>${rows.length} רשומות</span></div>
      ${tasksTable(rows)}
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
  return `
    <form class="form-grid inline-form" data-form="file" data-patient-id="${html(patientId)}">
      ${
        patientId
          ? ""
          : `<div class="field">
              <label for="file_patient_id">מטופל</label>
              <select id="file_patient_id" name="patient_id" required>
                <option value="">בחירה</option>
                ${patientOptions()}
              </select>
            </div>`
      }
      <div class="field">
        <label for="file_name">שם קובץ</label>
        <input id="file_name" name="name" placeholder="אם ריק, יישמר בשם הקובץ המקורי" />
      </div>
      <div class="field">
        <label for="file_type">סוג</label>
        <select id="file_type" name="file_type">
          <option value="document">מסמך</option>
          <option value="summary">סיכום</option>
          <option value="receipt">קבלה</option>
          <option value="form">טופס</option>
          <option value="recording">הקלטה</option>
          <option value="other">אחר</option>
        </select>
      </div>
      <div class="field wide">
        <label for="file_upload">קובץ להעלאה</label>
        <input id="file_upload" name="upload" type="file" required />
      </div>
      <div class="toolbar wide">
        <button class="button" type="submit">העלאת קובץ</button>
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
                    ${
                      file.url
                        ? `<a class="button table-button" href="${html(file.url)}" target="_blank" rel="noopener">פתיחה</a>`
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

function filesPage() {
  const rows = [...state.files].sort((a, b) => `${b.created_at}`.localeCompare(`${a.created_at}`));
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
      <div class="panel-head"><h2>קובץ חדש</h2><span>העלאה לתיקיית המטופל</span></div>
      ${fileForm()}
    </section>
    <section class="panel page-gap">
      <div class="panel-head"><h2>רשימת קבצים</h2><span>${rows.length} רשומות</span></div>
      ${filesTable(rows)}
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

function patientName(patientId) {
  return state.patients.find((patient) => patient.id === patientId)?.child_name || "ללא מטופל";
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
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    callback: async (response) => {
      if (response.error) {
        state.error = "ההתחברות לאחסון נכשלה.";
        render();
        return;
      }

      state.accessToken = response.access_token;
      saveGoogleToken(response);
      await loadData();
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

  if (status === 401 || combined.includes("invalid credentials")) {
    clearStoredGoogleToken();
    state.accessToken = "";
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

async function deleteFileRecord(fileId) {
  const file = state.files.find((item) => item.id === fileId);
  if (!file) throw new Error("הקובץ לא נמצא.");
  if (!file._rowNumber) throw new Error("צריך לרענן נתונים לפני מחיקת הקובץ.");

  if (file.drive_file_id) await trashDriveFile(file.drive_file_id);
  await clearSheetRow("files", file._rowNumber);
  state.files = state.files.filter((item) => item.id !== fileId);
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
  if (!state.accessToken || !state.config.googleSpreadsheetId) return;
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

  if (!patientId) throw new Error("לא נמצא מטופל לשמירת המפגש.");
  if (!data.session_date) throw new Error("תאריך מפגש הוא שדה חובה.");

  const now = new Date().toISOString();
  const session = {
    id: id(),
    patient_id: patientId,
    session_date: data.session_date,
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    location: data.location || "",
    session_type: data.session_type || "",
    summary: data.summary || "",
    sensitive_notes: data.sensitive_notes || "",
    calendar_event_id: "",
    created_at: now,
    updated_at: now
  };

  await appendSheet("sessions", session);
  state.sessions = [session, ...state.sessions].sort((a, b) =>
    `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
  );
}

async function savePayment(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || "";

  if (!patientId) throw new Error("לא נמצא מטופל לשמירת התשלום.");
  if (!data.amount) throw new Error("סכום התשלום הוא שדה חובה.");

  const now = new Date().toISOString();
  const payment = {
    id: id(),
    patient_id: patientId,
    session_id: "",
    amount: data.amount,
    payment_method: data.payment_method || "bank_transfer",
    payment_status: data.payment_status || "paid",
    receipt_status: data.receipt_status || "needed",
    paid_at: data.paid_at || isoDate(new Date()),
    receipt_file_id: "",
    notes: data.notes || "",
    created_at: now,
    updated_at: now
  };

  await appendSheet("payments", payment);
  state.payments = [payment, ...state.payments].sort((a, b) =>
    `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
  );
}

async function saveTask(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const patientId = form.dataset.patientId || data.patient_id || "";

  if (!patientId) throw new Error("צריך לבחור מטופל למשימה.");
  if (!data.title) throw new Error("כותרת המשימה היא שדה חובה.");

  const now = new Date().toISOString();
  const task = {
    id: id(),
    patient_id: patientId,
    title: data.title,
    description: data.description || "",
    status: data.status || "open",
    due_date: data.due_date || "",
    source: "manual",
    created_at: now,
    updated_at: now
  };

  const appendResult = await appendSheet("tasks", task);
  task._rowNumber = appendedRowNumber(appendResult);
  state.tasks = [task, ...state.tasks].sort((a, b) =>
    `${a.due_date || "9999-99-99"} ${a.created_at}`.localeCompare(`${b.due_date || "9999-99-99"} ${b.created_at}`)
  );
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
  const fileName = fileNameWithFallback(data.name, selectedFile);

  if (!patientId) throw new Error("צריך לבחור מטופל לקובץ.");
  if (!selectedFile) throw new Error("צריך לבחור קובץ להעלאה.");

  await uploadPatientFile(patientId, selectedFile, data.file_type || "document", fileName);
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
      navigate(`patients/${target.dataset.id}`);
    }
    if (action === "profile-tab") {
      state.profileTab = target.dataset.tab || "overview";
      render();
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
  });

  document.addEventListener("input", (event) => {
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

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!form.matches("[data-form]")) return;
    event.preventDefault();
    state.error = "";
    state.message = "";

    try {
      if (form.dataset.form === "settings") {
        saveConfig(Object.fromEntries(new FormData(form).entries()));
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
        state.message = "המפגש נשמר במערכת.";
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
        await saveFile(form);
        state.message = "הקובץ הועלה ונרשם בכרטיס המטופל.";
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
  document.getElementById("app").innerHTML = (pages[route] || dashboardPage)();
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
