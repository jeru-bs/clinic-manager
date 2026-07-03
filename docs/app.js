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
  ]
};

const configDefaults = window.CLINIC_MANAGER_CONFIG || {};
const state = {
  accessToken: loadStoredGoogleToken(),
  config: loadConfig(),
  currentPatientId: "",
  message: "",
  error: "",
  patients: [],
  sessions: [],
  payments: [],
  route: getRoute()
};

function loadConfig() {
  const saved = JSON.parse(localStorage.getItem("clinic-manager-config") || "{}");
  return {
    appName: saved.appName || configDefaults.appName || "ניהול קליניקה",
    googleClientId: saved.googleClientId || configDefaults.googleClientId || "",
    googleDriveRootFolderId:
      saved.googleDriveRootFolderId ||
      configDefaults.googleDriveRootFolderId ||
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
    const stored = JSON.parse(sessionStorage.getItem("clinic-manager-google-token") || "null");

    if (!stored?.accessToken || !stored?.expiresAt || Date.now() > stored.expiresAt) {
      sessionStorage.removeItem("clinic-manager-google-token");
      return "";
    }

    return stored.accessToken;
  } catch {
    sessionStorage.removeItem("clinic-manager-google-token");
    return "";
  }
}

function saveGoogleToken(response) {
  const expiresInSeconds = Number(response.expires_in || 3300);
  const expiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;

  sessionStorage.setItem(
    "clinic-manager-google-token",
    JSON.stringify({
      accessToken: response.access_token,
      expiresAt
    })
  );
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
          <span class="side-brand-mark">קל</span>
          <span>${html(state.config.appName)}</span>
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
      יש להתחבר לגוגל כדי לקרוא ולשמור נתונים ב-Google Sheets.
      <button class="button blue" data-action="connect-google" type="button">התחברות לגוגל</button>
    </div>`;
}

function header(title, subtitle, actions = "") {
  return `
    <section class="header">
      <div>
        <p class="eyebrow">מערכת דפדפן</p>
        <h1>${html(title)}</h1>
        <p>${html(subtitle)}</p>
      </div>
      <div class="toolbar">${actions}</div>
    </section>`;
}

function dashboardPage() {
  const openPayments = state.payments.filter((payment) => payment.payment_status !== "paid").length;
  const openTasks = 0;
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = state.sessions.filter((session) => session.session_date === today).length;

  return shell(`
    ${header(
      "דשבורד",
      "סקירה מהירה של היום, משימות פתוחות ותשלומים לטיפול.",
      `<button class="button" data-action="open-patient-drawer" type="button">מטופל חדש +</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>
       <a class="button yellow" href="#/settings">הגדרות גוגל</a>`
    )}
    ${connectionBanner()}
    <section class="kpi-grid">
      <article class="kpi-card blue-card"><div><strong>${todaySessions}</strong><span>מפגשים היום</span></div><span class="kpi-symbol">מ</span></article>
      <article class="kpi-card teal-card"><div><strong>${openTasks}</strong><span>משימות פתוחות</span></div><span class="kpi-symbol">ש</span></article>
      <article class="kpi-card pink-card"><div><strong>${openPayments}</strong><span>תשלומים פתוחים</span></div><span class="kpi-symbol">ת</span></article>
      <article class="kpi-card purple-card"><div><strong>${state.patients.length}</strong><span>מטופלים פעילים</span></div><span class="kpi-symbol">פ</span></article>
    </section>
    <section class="grid-two">
      ${sessionsPanel()}
      ${paymentsPanel()}
    </section>
    ${patientDrawer()}
  `);
}

function patientsPage() {
  return shell(`
    ${header(
      "מטופלים",
      "רשימת מטופלים קיימים מתוך Google Sheets.",
      `<button class="button" data-action="open-patient-drawer" type="button">הוסף מטופל +</button>
       <button class="button secondary" data-action="refresh" type="button">רענון</button>
       <a class="button yellow" href="#/settings">הגדרות</a>`
    )}
    ${connectionBanner()}
    <section class="panel">
      <div class="panel-head"><h2>מטופלים קיימים</h2><span>${state.patients.length} רשומות</span></div>
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
              <td><input class="table-filter" placeholder="חיפוש שם" data-filter="name" /></td>
              <td><input class="table-filter" placeholder="מוסד" /></td>
              <td><input class="table-filter" placeholder="סוג טיפול" /></td>
              <td><input class="table-filter" placeholder="סטטוס" /></td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            ${state.patients
              .map(
                (patient) => `
                <tr>
                  <td><strong>${html(patient.child_name)}</strong></td>
                  <td>${html(patient.school_name || "-")}</td>
                  <td>${html(patient.treatment_type || "-")}</td>
                  <td><span class="status-pill">${html(paymentStatusLabel(patient.payment_status))}</span></td>
                  <td>
                    <div class="actions">
                      <button class="small-action" data-action="open-profile" data-id="${html(patient.id)}" type="button">↗</button>
                      <button class="small-action edit" data-action="open-patient-drawer" data-id="${html(patient.id)}" type="button">✎</button>
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

  return shell(`
    ${header(
      patient.child_name,
      `${patient.treatment_type || "סוג טיפול לא הוגדר"} | ${patient.fixed_day || "ללא יום קבוע"} ${patient.fixed_time || ""}`,
      `<a class="button secondary" href="#/patients">חזרה לרשימה</a>`
    )}
    <section class="profile">
      <section class="grid-two">
        <article class="panel">
          <div class="panel-head"><h2>פרטים כלליים</h2><span>מתוך Google Sheets</span></div>
          <div class="detail-list">
            ${detail("שם", patient.child_name)}
            ${detail("מוסד לימודים", patient.school_name)}
            ${detail("סוג טיפול", patient.treatment_type)}
            ${detail("מחיר קבוע", patient.fixed_price)}
          </div>
        </article>
        <article class="panel">
          <div class="panel-head"><h2>תיעוד והערות</h2><span>מידע פנימי</span></div>
          <div class="detail-list">
            ${detail("מטרות טיפול", patient.treatment_goals)}
            ${detail("הערות כלליות", patient.general_notes)}
          </div>
        </article>
      </section>
      <section class="profile-grid">
        ${sessionsPanel(sessions)}
        ${paymentsPanel(payments)}
        <article class="panel">
          <div class="panel-head"><h2>קבצים</h2><span>Google Drive</span></div>
          <div class="empty">${patient.drive_folder_id ? "תיקיית המטופל נוצרה בדרייב." : "טרם נוצרה תיקיית מטופל."}</div>
        </article>
      </section>
    </section>
  `);
}

function settingsPage() {
  return shell(`
    ${header("הגדרות", "חיבור הדפדפן לגוגל. אין כאן סוד שרת, רק Client ID ציבורי של Google OAuth.", `<button class="button blue" data-action="connect-google" type="button">התחברות לגוגל</button>`)}
    <section class="grid-two">
      <article class="panel">
        <div class="panel-head"><h2>פרטי חיבור</h2><span>נשמר בדפדפן שלך</span></div>
        <form class="form-grid" data-form="settings">
          <div class="field wide">
            <label for="googleClientId">Google Client ID</label>
            <input id="googleClientId" name="googleClientId" value="${html(state.config.googleClientId)}" placeholder="xxxx.apps.googleusercontent.com" />
          </div>
          <div class="field wide">
            <label for="googleSpreadsheetId">Google Sheets ID</label>
            <input id="googleSpreadsheetId" name="googleSpreadsheetId" value="${html(state.config.googleSpreadsheetId)}" />
          </div>
          <div class="field wide">
            <label for="googleDriveRootFolderId">תיקיית Drive ראשית</label>
            <input id="googleDriveRootFolderId" name="googleDriveRootFolderId" value="${html(state.config.googleDriveRootFolderId)}" />
          </div>
          <div class="toolbar wide">
            <button class="button" type="submit">שמירת הגדרות</button>
          </div>
        </form>
      </article>
      <article class="panel">
        <div class="panel-head"><h2>מצב</h2><span>GitHub Pages</span></div>
        <div class="settings-card">
          <p><strong>קוד:</strong> נטען מגיטהאב.</p>
          <p><strong>נתונים:</strong> Google Sheets ו-Google Drive.</p>
          <p><strong>חיבור:</strong> ${state.accessToken ? "מחובר לגוגל כרגע." : "לא מחובר כרגע."}</p>
        </div>
      </article>
    </section>
  `);
}

function placeholderPage(title) {
  return shell(`${header(title, "המסך הזה יתחבר לשיטס בשלב הבא.", `<button class="button secondary" data-action="refresh" type="button">רענון</button>`)}<section class="panel"><div class="empty">בקרוב.</div></section>`);
}

function detail(label, value) {
  return `<div class="detail"><span>${html(label)}</span><strong>${html(value || "-")}</strong></div>`;
}

function sessionsPanel(items = state.sessions) {
  const rows = items.slice(0, 5);
  return `
    <article class="panel">
      <div class="panel-head"><h2>מפגשים קרובים</h2><span>היום והשבוע הקרוב</span></div>
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
          : `<div class="empty">עדיין אין מפגשים להצגה.</div>`
      }
    </article>`;
}

function paymentsPanel(items = state.payments) {
  const rows = items.slice(0, 5);
  return `
    <article class="panel">
      <div class="panel-head"><h2>תשלומים</h2><span>מעקב גבייה</span></div>
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

function patientDrawer() {
  return `
    <section class="drawer" id="patientDrawer" hidden>
      <div class="drawer-inner">
        <div class="panel-head">
          <h2>הוספת מטופל</h2>
          <button class="button secondary" data-action="close-drawer" type="button">סגירה</button>
        </div>
        <form class="form-grid" data-form="patient">
          <div class="field">
            <label for="child_name">שם</label>
            <input id="child_name" name="child_name" required />
          </div>
          <div class="field">
            <label for="school_name">מוסד</label>
            <input id="school_name" name="school_name" />
          </div>
          <div class="field">
            <label for="treatment_type">סוג טיפול</label>
            <input id="treatment_type" name="treatment_type" />
          </div>
          <div class="field">
            <label for="fixed_price">מחיר קבוע</label>
            <input id="fixed_price" name="fixed_price" inputmode="decimal" />
          </div>
          <div class="field">
            <label for="fixed_day">יום קבוע</label>
            <input id="fixed_day" name="fixed_day" />
          </div>
          <div class="field">
            <label for="fixed_time">שעה קבועה</label>
            <input id="fixed_time" name="fixed_time" type="time" />
          </div>
          <div class="field wide">
            <label for="general_notes">הערות</label>
            <textarea id="general_notes" name="general_notes"></textarea>
          </div>
          <div class="toolbar wide">
            <button class="button" type="submit">שמירה ל-Google Sheets</button>
            <button class="button secondary" data-action="close-drawer" type="button">ביטול</button>
          </div>
        </form>
      </div>
    </section>`;
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
    check: "צ'ק"
  }[value] || "העברה";
}

async function connectGoogle() {
  state.error = "";
  state.message = "";

  if (!state.config.googleClientId) {
    state.error = "צריך להכניס Google Client ID במסך ההגדרות.";
    navigate("settings");
    render();
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    state.error = "רכיב ההתחברות של Google עדיין לא נטען. נסו שוב בעוד רגע.";
    render();
    return;
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.googleClientId,
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    callback: async (response) => {
      if (response.error) {
        state.error = "ההתחברות לגוגל נכשלה.";
        render();
        return;
      }

      state.accessToken = response.access_token;
      saveGoogleToken(response);
      state.message = "החיבור לגוגל הצליח.";
      await loadData();
      render();
    }
  });

  tokenClient.requestAccessToken({ prompt: "consent" });
}

async function googleFetch(url, options = {}) {
  if (!state.accessToken) throw new Error("לא מחוברים לגוגל.");
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
    throw new Error(text || "קריאה לגוגל נכשלה.");
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
    .filter((row) => row.some(Boolean))
    .map((row) => rowToRecord(columns, row));
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
  await googleFetch(url.toString(), {
    method: "POST",
    body: JSON.stringify({ values: [recordToRow(columns, record)] })
  });
}

async function createPatientFolder(patientNameValue) {
  if (!state.config.googleDriveRootFolderId) return { id: "", path: "" };
  const folderName = `${patientNameValue} - ${new Date().toISOString().slice(0, 10)}`;
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

async function loadData() {
  if (!state.accessToken || !state.config.googleSpreadsheetId) return;
  const [patients, sessions, payments] = await Promise.all([
    readSheet("patients"),
    readSheet("sessions"),
    readSheet("payments")
  ]);
  state.patients = patients.sort((a, b) => (a.child_name || "").localeCompare(b.child_name || "", "he"));
  state.sessions = sessions.sort((a, b) => `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`));
  state.payments = payments.sort((a, b) => `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`));
}

async function savePatient(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.child_name) throw new Error("שם המטופל הוא שדה חובה.");

  const now = new Date().toISOString();
  const folder = await createPatientFolder(data.child_name);
  const patient = {
    id: id(),
    child_name: data.child_name,
    address: "",
    school_name: data.school_name || "",
    treatment_type: data.treatment_type || "",
    fixed_price: data.fixed_price || "",
    fixed_day: data.fixed_day || "",
    fixed_time: data.fixed_time || "",
    treatment_goals: "",
    sensitive_notes: "",
    general_notes: data.general_notes || "",
    status: "active",
    default_payment_method: "bank_transfer",
    payment_status: "unpaid",
    receipt_status: "needed",
    drive_folder_id: folder.id,
    drive_folder_path: folder.path,
    created_at: now,
    updated_at: now
  };

  await appendSheet("patients", patient);
  state.patients = [patient, ...state.patients].sort((a, b) =>
    (a.child_name || "").localeCompare(b.child_name || "", "he")
  );
}

function bindEvents() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action === "connect-google") await connectGoogle();
    if (action === "refresh") {
      await loadData().catch((error) => {
        state.error = error.message;
      });
      render();
    }
    if (action === "open-patient-drawer") {
      document.getElementById("patientDrawer")?.removeAttribute("hidden");
    }
    if (action === "close-drawer") {
      document.getElementById("patientDrawer")?.setAttribute("hidden", "");
    }
    if (action === "open-profile") {
      navigate(`patients/${target.dataset.id}`);
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
        if (!state.accessToken) throw new Error("צריך להתחבר לגוגל לפני שמירה.");
        await savePatient(form);
        state.message = "המטופל נשמר ב-Google Sheets ונוצרה תיקייה בדרייב.";
      }

      render();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "הפעולה נכשלה.";
      render();
    }
  });
}

function render() {
  state.route = getRoute();
  const [route, idPart] = state.route.split("/");
  const pages = {
    dashboard: dashboardPage,
    patients: () => (idPart ? profilePage(idPart) : patientsPage()),
    calendar: () => placeholderPage("יומן"),
    tasks: () => placeholderPage("משימות"),
    payments: () => placeholderPage("תשלומים"),
    files: () => placeholderPage("קבצים"),
    settings: settingsPage
  };
  document.getElementById("app").innerHTML = (pages[route] || dashboardPage)();
}

window.addEventListener("hashchange", render);
render();
bindEvents();

if (state.accessToken) {
  loadData()
    .then(render)
    .catch((error) => {
      sessionStorage.removeItem("clinic-manager-google-token");
      state.accessToken = "";
      state.error =
        error instanceof Error ? error.message : "החיבור לגוגל פג תוקף.";
      render();
    });
}
