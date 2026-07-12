import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { createServer } from "http";
import { dirname, resolve } from "path";

const port = Number(process.env.PORT || 3000);
const envPath = resolve(".env.local");
const patientsFilePath = resolve("work", "local-data", "patients.json");
const sessionsFilePath = resolve("work", "local-data", "sessions.json");
const paymentsFilePath = resolve("work", "local-data", "payments.json");
const sessionCookieName = "clinic_session";

function loadEnvFile() {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) process.env[match[1]] ||= match[2];
  }
}

loadEnvFile();

const appName = process.env.NEXT_PUBLIC_APP_NAME || "ניהול קליניקה";
const passwordHash = process.env.APP_PASSWORD_HASH || "";
const sessionSecret = process.env.SESSION_SECRET || "";

function ensurePatientsFile() {
  mkdirSync(dirname(patientsFilePath), { recursive: true });
  if (!existsSync(patientsFilePath)) writeFileSync(patientsFilePath, "[]", "utf8");
}

function readPatients() {
  ensurePatientsFile();

  try {
    const patients = JSON.parse(readFileSync(patientsFilePath, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(patients) ? patients : [];
  } catch {
    return [];
  }
}

function writePatients(patients) {
  ensurePatientsFile();
  writeFileSync(patientsFilePath, `${JSON.stringify(patients, null, 2)}\n`, "utf8");
}

function getPatient(id) {
  return readPatients().find((patient) => patient.id === id);
}

function ensureSessionsFile() {
  mkdirSync(dirname(sessionsFilePath), { recursive: true });
  if (!existsSync(sessionsFilePath)) writeFileSync(sessionsFilePath, "[]", "utf8");
}

function readSessions() {
  ensureSessionsFile();

  try {
    const sessions = JSON.parse(readFileSync(sessionsFilePath, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  ensureSessionsFile();
  writeFileSync(sessionsFilePath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
}

function readPatientSessions(patientId) {
  return readSessions()
    .filter((session) => session.patient_id === patientId)
    .sort((a, b) =>
      `${b.session_date} ${b.start_time}`.localeCompare(`${a.session_date} ${a.start_time}`)
    );
}

function ensurePaymentsFile() {
  mkdirSync(dirname(paymentsFilePath), { recursive: true });
  if (!existsSync(paymentsFilePath)) writeFileSync(paymentsFilePath, "[]", "utf8");
}

function readPayments() {
  ensurePaymentsFile();

  try {
    const payments = JSON.parse(readFileSync(paymentsFilePath, "utf8").replace(/^\uFEFF/, ""));
    return Array.isArray(payments) ? payments : [];
  } catch {
    return [];
  }
}

function writePayments(payments) {
  ensurePaymentsFile();
  writeFileSync(paymentsFilePath, `${JSON.stringify(payments, null, 2)}\n`, "utf8");
}

function readPatientPayments(patientId) {
  return readPayments()
    .filter((payment) => payment.patient_id === patientId)
    .sort((a, b) => `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function valueOrDash(value) {
  return escapeHtml(String(value || "").trim() || "-");
}

function createPatient(fields) {
  const now = new Date().toISOString();
  const patient = {
    id: randomUUID(),
    child_name: (fields.get("child_name") || "").trim(),
    address: "",
    school_name: (fields.get("school_name") || "").trim(),
    treatment_type: (fields.get("treatment_type") || "").trim(),
    fixed_day: (fields.get("fixed_day") || "").trim(),
    fixed_time: (fields.get("fixed_time") || "").trim(),
    fixed_price: (fields.get("fixed_price") || "").trim(),
    treatment_goals: "",
    general_notes: (fields.get("general_notes") || "").trim(),
    sensitive_notes: (fields.get("sensitive_notes") || "").trim(),
    status: "active",
    default_payment_method: "bank_transfer",
    payment_status: "unpaid",
    receipt_status: "needed",
    drive_folder_id: "",
    drive_folder_path: "",
    created_at: now,
    updated_at: now
  };

  if (!patient.child_name) throw new Error("שם הילד הוא שדה חובה.");

  const patients = readPatients();
  patients.push(patient);
  writePatients(patients);
}

function patientFieldsFromForm(fields, current = {}) {
  return {
    ...current,
    child_name: (fields.get("child_name") || "").trim(),
    school_name: (fields.get("school_name") || "").trim(),
    treatment_type: (fields.get("treatment_type") || "").trim(),
    fixed_day: (fields.get("fixed_day") || "").trim(),
    fixed_time: (fields.get("fixed_time") || "").trim(),
    fixed_price: (fields.get("fixed_price") || "").trim(),
    general_notes: (fields.get("general_notes") || "").trim(),
    sensitive_notes: (fields.get("sensitive_notes") || "").trim()
  };
}

function updatePatient(patientId, fields) {
  const patients = readPatients();
  const index = patients.findIndex((patient) => patient.id === patientId);

  if (index === -1) throw new Error("המטופל לא נמצא.");

  const updated = {
    ...patientFieldsFromForm(fields, patients[index]),
    id: patients[index].id,
    address: patients[index].address || "",
    status: patients[index].status || "active",
    default_payment_method: patients[index].default_payment_method || "bank_transfer",
    payment_status: patients[index].payment_status || "unpaid",
    receipt_status: patients[index].receipt_status || "needed",
    drive_folder_id: patients[index].drive_folder_id || "",
    drive_folder_path: patients[index].drive_folder_path || "",
    created_at: patients[index].created_at,
    updated_at: new Date().toISOString()
  };

  if (!updated.child_name) throw new Error("שם הילד הוא שדה חובה.");

  patients[index] = updated;
  writePatients(patients);
}

function deletePatient(patientId) {
  const patients = readPatients();
  const nextPatients = patients.filter((patient) => patient.id !== patientId);

  if (nextPatients.length === patients.length) throw new Error("המטופל לא נמצא.");

  writePatients(nextPatients);
}

function createTreatmentSession(patientId, fields) {
  const sessionDate = (fields.get("session_date") || "").trim();

  if (!sessionDate) throw new Error("תאריך מפגש הוא שדה חובה.");

  const now = new Date().toISOString();
  const session = {
    id: randomUUID(),
    patient_id: patientId,
    session_date: sessionDate,
    start_time: (fields.get("start_time") || "").trim(),
    end_time: (fields.get("end_time") || "").trim(),
    location: (fields.get("location") || "").trim(),
    session_type: (fields.get("session_type") || "").trim(),
    summary: (fields.get("summary") || "").trim(),
    sensitive_notes: (fields.get("sensitive_notes") || "").trim(),
    calendar_event_id: "",
    created_at: now,
    updated_at: now
  };
  const sessions = readSessions();

  sessions.push(session);
  writeSessions(sessions);
}

function createPayment(patientId, fields) {
  const amount = (fields.get("amount") || "").trim();

  if (!amount) throw new Error("סכום התשלום הוא שדה חובה.");

  const now = new Date().toISOString();
  const payment = {
    id: randomUUID(),
    patient_id: patientId,
    session_id: "",
    amount,
    payment_method: (fields.get("payment_method") || "bank_transfer").trim(),
    payment_status: (fields.get("payment_status") || "paid").trim(),
    receipt_status: (fields.get("receipt_status") || "needed").trim(),
    paid_at: (fields.get("paid_at") || new Date().toISOString().slice(0, 10)).trim(),
    receipt_file_id: "",
    notes: (fields.get("notes") || "").trim(),
    created_at: now,
    updated_at: now
  };
  const payments = readPayments();

  payments.push(payment);
  writePayments(payments);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeCompare(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({ createdAt: Date.now() }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function hasSession(request) {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.split("=")[1];

  if (!token) return false;

  const [payload, signature] = token.split(".");
  return Boolean(payload && signature && safeCompare(sign(payload), signature));
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    ...headers
  });
  response.end(body);
}

function iconSvg(name) {
  const common = `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true" focusable="false"`;
  const icons = {
    dashboard: `<svg ${common}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M12 13l4-4"/><path d="M6.5 19h11"/></svg>`,
    patients: `<svg ${common}><path d="M16 19v-1a4 4 0 0 0-8 0v1"/><circle cx="12" cy="8" r="3"/><path d="M19 19v-1.2a3 3 0 0 0-2-2.8"/><path d="M17 5.4a2.5 2.5 0 0 1 0 5.2"/></svg>`,
    calendar: `<svg ${common}><rect height="16" rx="2" width="18" x="3" y="5"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/></svg>`,
    tasks: `<svg ${common}><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/></svg>`,
    payments: `<svg ${common}><rect height="14" rx="2" width="18" x="3" y="5"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>`,
    files: `<svg ${common}><path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>`,
    settings: `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2.1.4l-.1.1h-4l-.1-.1a1.8 1.8 0 0 0-2.1-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2"/><path d="M4.6 9a1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2.1-.4l.1-.1h4l.1.1a1.8 1.8 0 0 0 2.1.4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2"/></svg>`
  };
  return icons[name] || "";
}

function shell(content, active = "dashboard") {
  const nav = [
    ["dashboard", "/dashboard", "dashboard", "דשבורד"],
    ["patients", "/patients", "patients", "מטופלים"],
    ["calendar", "/dashboard", "calendar", "יומן"],
    ["tasks", "/dashboard", "tasks", "משימות"],
    ["payments", "/dashboard", "payments", "תשלומים"],
    ["files", "/dashboard", "files", "קבצים"],
    ["settings", "/settings", "settings", "הגדרות"]
  ]
    .map(
      ([key, href, icon, label]) => `<a class="side-link ${active === key ? "active" : ""}" href="${href}">
        <span class="side-glyph">${iconSvg(icon)}</span>
        <span>${label}</span>
      </a>`
    )
    .join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(appName)}</title>
  <style>
    :root{--bg:#f3f5fb;--surface:#fff;--side:#171727;--side2:#10101d;--border:#dde2ee;--table:#e7ebf3;--text:#252a36;--muted:#747b8c;--primary:#5974e8;--teal:#22bfb2;--yellow:#ffc04d;--pink:#f43f7d;--purple:#7254c7;--danger:#d92d67;--shadow:0 14px 40px rgba(26,31,50,.08)}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:Arial,system-ui,sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}a{text-decoration:none}
    .auth{min-height:100vh;display:grid;place-items:center;padding:24px}.auth-panel{width:min(100%,430px);background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);padding:28px}.eyebrow{margin:0 0 10px;color:var(--primary);font-weight:800}h1{margin:0;font-size:2rem}p{color:var(--muted)}form{display:grid;gap:14px;margin-top:20px}label{font-weight:800}input,textarea{width:100%;border:1px solid #cfd5e3;border-radius:3px;background:#fff;color:var(--text);padding:0 10px}input{min-height:38px}textarea{min-height:70px;padding:10px;resize:vertical}button{min-height:38px;border:0;border-radius:4px;background:var(--teal);color:#fff;font-weight:800;padding:0 14px}.error{border:1px solid rgba(217,45,103,.24);background:#fff1f5;color:var(--danger);padding:10px;border-radius:4px}.success{border:1px solid rgba(34,191,178,.28);background:#ecfffc;color:#087b72;padding:10px;border-radius:4px}
    .app{display:grid;grid-template-columns:minmax(0,1fr) 138px;direction:ltr;min-height:100vh}.side{position:sticky;top:0;grid-column:2;grid-row:1;direction:rtl;min-height:100vh;background:var(--side);color:#d9def4;border-left:1px solid #2b2d44}.brand{min-height:112px;display:grid;gap:8px;place-items:center;text-align:center;padding:14px 10px;border-bottom:1px solid #2b2d44;font-weight:900}.brand-mark{display:grid;width:52px;height:52px;place-items:center;border-radius:4px;background:#22375f;color:#fff}.side-menu{display:grid;gap:2px;padding:12px 0}.side-link{position:relative;display:grid;gap:6px;min-height:74px;place-items:center;color:#8f96b3;text-align:center;padding:10px 8px}.side-link:hover,.side-link.active{background:var(--side2);color:#fff}.side-link.active:before{position:absolute;inset-block:0;left:0;width:4px;background:var(--primary);content:""}.side-glyph{display:grid;width:30px;height:30px;place-items:center;border-radius:6px;background:rgba(89,116,232,.14);color:#6f87ff}.side-glyph svg{width:18px;height:18px}.main{grid-column:1;grid-row:1;direction:rtl;min-width:0;overflow:hidden;padding:0 20px 48px}.header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:92px;margin:0 -20px 18px;border-bottom:1px solid var(--border);background:#fff;padding:18px 24px}.toolbar,.actions,.profile-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.btn{display:inline-grid;min-height:38px;place-items:center;border-radius:4px;padding:0 14px;color:#fff;font-weight:800}.btn.blue{background:var(--primary)}.btn.yellow{background:var(--yellow);color:#33240a}.btn.secondary{border:1px solid var(--border);background:#fff;color:var(--text)}.btn.danger{background:var(--danger)}
    .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.kpi{display:flex;align-items:center;justify-content:space-between;min-height:126px;border-radius:4px;color:#fff;padding:22px 24px}.kpi strong{display:block;font-size:2rem}.kpi span{display:block;margin-top:10px;opacity:.9}.kpi .sym{display:grid;width:54px;height:54px;place-items:center;border-radius:50%;background:rgba(255,255,255,.16);font-weight:900}.blue-card{background:var(--primary)}.teal-card{background:var(--teal)}.pink-card{background:var(--pink)}.purple-card{background:var(--purple)}
    .panel{background:#fff;border:1px solid var(--border);border-radius:4px;box-shadow:var(--shadow)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:54px;border-bottom:1px solid var(--table);padding:12px 16px}.panel-head h2{margin:0;font-size:1.05rem}.panel-head span{color:var(--muted)}.tables{display:grid;grid-template-columns:1fr 1fr;gap:18px}.wrap{overflow-x:auto}table{width:100%;min-width:760px;border-collapse:collapse;background:#fff;font-size:.94rem}th,td{border:1px solid var(--table);padding:10px 12px;text-align:start;vertical-align:middle}th{background:#f0f3f8;color:#2f3543;font-weight:800}.empty{display:grid;min-height:120px;place-items:center;color:var(--muted);text-align:center;padding:18px}
    .toolbar-panel{margin-bottom:18px;background:#fff;border:1px solid var(--border);border-radius:4px;box-shadow:var(--shadow);padding:16px}.drawer{position:fixed;inset:0;z-index:50;display:grid;place-items:start center;overflow-y:auto;background:rgba(16,16,29,.42);padding:56px 18px}.drawer[hidden]{display:none}.drawer-inner{width:min(100%,980px);border:1px solid var(--border);border-radius:6px;background:#fff;box-shadow:0 24px 70px rgba(16,16,29,.22)}.confirm-dialog{width:min(100%,430px);border:1px solid var(--border);border-radius:6px;background:#fff;box-shadow:0 24px 70px rgba(16,16,29,.22);padding:22px}.confirm-dialog h2,.confirm-dialog p{margin:0 0 12px}.dialog-warning{color:var(--muted);line-height:1.55}.drawer .body{padding:16px}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.wide{grid-column:span 3}.filter{min-height:34px}.act{display:grid;min-width:34px;min-height:32px;place-items:center;border:1px solid var(--border);background:#fff;color:#4d5565}.act.edit{background:var(--purple);color:#fff}.act.delete{color:var(--danger)}.pill{display:inline-grid;min-width:58px;min-height:24px;place-items:center;border-radius:4px;background:#eef3ff;color:#3f58ce;font-weight:800}.name{font-weight:800}.sub{color:var(--muted)}
    .profile{display:grid;gap:18px}.profile-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:132px;margin:0 -20px 18px;border-bottom:1px solid var(--border);background:#fff;padding:22px 24px}.profile-hero h1{font-size:clamp(2rem,4vw,3.2rem)}.mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.mini{border:1px solid var(--border);border-radius:4px;background:#fff;box-shadow:var(--shadow);padding:16px}.mini span{display:block;color:var(--muted);font-size:.9rem}.mini strong{display:block;margin-top:8px;font-size:1.3rem}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.profile-grid.three{grid-template-columns:repeat(3,1fr)}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--table)}.detail{min-height:78px;background:#fff;padding:14px 16px}.detail span{display:block;color:var(--muted);font-size:.9rem}.detail strong{display:block;margin-top:8px}.notes{display:grid;gap:12px;padding:16px}.note{border:1px solid var(--table);border-radius:4px;background:#fff;padding:14px}.note.sensitive{border-color:rgba(217,45,103,.22);background:#fff7fa}.note h3{margin:0 0 8px}.note p{margin:0;white-space:pre-wrap}.session-form{display:grid;gap:12px;border-bottom:1px solid var(--table);padding:16px}.session-list{display:grid;gap:10px;padding:16px}.session-item{display:grid;grid-template-columns:100px 120px 1fr;gap:12px;border:1px solid var(--table);border-radius:4px;background:#fff;padding:12px}.session-item strong,.session-item span{display:block}.session-item span{color:var(--muted);font-size:.88rem}.session-item p{margin:0;white-space:pre-wrap}
    .payment-form{display:grid;gap:12px;border-bottom:1px solid var(--table);padding:16px}.payment-list{display:grid;gap:10px;padding:16px}.payment-item{display:grid;grid-template-columns:88px 88px 76px 1fr;gap:12px;border:1px solid var(--table);border-radius:4px;background:#fff;padding:12px}.payment-item strong,.payment-item span{display:block}.payment-item span{color:var(--muted);font-size:.88rem}.payment-item p{margin:0;white-space:pre-wrap}.payment-pill{display:inline-flex!important;width:fit-content;border-radius:999px;background:#eef5ff;color:var(--primary)!important;padding:4px 8px;font-size:.78rem!important;font-weight:800}
    @media(max-width:980px){.app{grid-template-columns:minmax(0,1fr) 88px}.brand{min-height:78px;font-size:.78rem}.brand-mark{width:38px;height:38px}.side-link{min-height:62px;font-size:.72rem}.side-glyph{width:26px;height:26px}.side-glyph svg{width:16px;height:16px}.main{padding-inline:12px}.kpis,.tables,.form-grid,.mini-grid,.profile-grid,.profile-grid.three{grid-template-columns:1fr}.wide{grid-column:auto}.payment-item{grid-template-columns:1fr}}@media(max-width:620px){.header,.panel-head,.profile-hero{align-items:stretch;flex-direction:column}.toolbar,.actions,.profile-actions{align-items:stretch;flex-direction:column}.detail-grid{grid-template-columns:1fr}}
  </style>
</head>
<body><div class="app"><main class="main">${content}</main><aside class="side"><div class="brand"><span class="brand-mark">קל</span><span>${escapeHtml(appName)}</span></div><nav class="side-menu">${nav}</nav></aside></div></body>
</html>`;
}

function loginPage(error = "") {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(appName)}</title><style>
body{margin:0;min-height:100vh;background:#f3f5fb;color:#252a36;font-family:Arial,system-ui,sans-serif}.auth{min-height:100vh;display:grid;place-items:center;padding:24px}.auth-panel{width:min(100%,430px);background:#fff;border:1px solid #dde2ee;border-radius:8px;box-shadow:0 14px 40px rgba(26,31,50,.08);padding:28px}.eyebrow{margin:0 0 10px;color:#5974e8;font-weight:800}h1{margin:0;font-size:2rem}p{color:#747b8c}form{display:grid;gap:14px;margin-top:20px}label{font-weight:800}input{width:100%;min-height:38px;border:1px solid #cfd5e3;border-radius:3px;padding:0 10px}button{min-height:38px;border:0;border-radius:4px;background:#22bfb2;color:#fff;font-weight:800}.error{border:1px solid rgba(217,45,103,.24);background:#fff1f5;color:#d92d67;padding:10px;border-radius:4px}
</style></head>
<body><main class="auth"><section class="auth-panel"><p class="eyebrow">מערכת פרטית</p><h1>${escapeHtml(appName)}</h1><p>כניסה מאובטחת לניהול הקליניקה.</p><form method="post" action="/login"><label for="password">סיסמה</label><input id="password" name="password" type="password" autocomplete="current-password" autofocus/>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}<button type="submit">כניסה</button></form></section></main></body></html>`;
}

function dashboardPage() {
  return shell(`<section class="header"><div><p class="eyebrow">תמונת מצב יומית</p><h1>דשבורד</h1><p>סקירה מהירה של היום, משימות פתוחות ותקלות שמחכות לטיפול.</p></div><div class="toolbar"><button class="btn yellow">סינון תאריך</button><button class="btn secondary">רענון</button><button class="btn">פעולה חדשה +</button></div></section>
<section class="kpis"><article class="kpi blue-card"><div><strong>0</strong><span>מפגשים היום</span></div><div class="sym">מ</div></article><article class="kpi teal-card"><div><strong>0</strong><span>משימות פתוחות</span></div><div class="sym">ש</div></article><article class="kpi pink-card"><div><strong>0</strong><span>תשלומים פתוחים</span></div><div class="sym">ת</div></article><article class="kpi purple-card"><div><strong>0</strong><span>כשלי סנכרון</span></div><div class="sym">ס</div></article></section>
<section class="tables"><div class="panel"><div class="panel-head"><h2>מפגשים קרובים</h2><span>היום והשבוע הקרוב</span></div><div class="wrap"><table><thead><tr><th>שעה</th><th>מטופל</th><th>סוג מפגש</th><th>מיקום</th><th>סטטוס</th></tr></thead><tbody><tr><td colspan="5"><div class="empty">עדיין אין מפגשים להצגה.</div></td></tr></tbody></table></div></div><div class="panel"><div class="panel-head"><h2>דורש טיפול</h2><span>משימות, תשלומים וסנכרון</span></div><div class="wrap"><table><thead><tr><th>סוג</th><th>פריט</th><th>עדיפות</th><th>פעולה</th></tr></thead><tbody><tr><td colspan="4"><div class="empty">אין התראות פתוחות כרגע.</div></td></tr></tbody></table></div></div></section>`);
}

function settingsPage() {
  return shell(`<section class="header"><div><p class="eyebrow">הגדרות מערכת</p><h1>חיבור Google Drive ו-Sheets</h1><p>הדרייב משמש לאחסון בלבד. הנתונים יוצגו במערכת מתוך Google Sheets.</p></div><div class="toolbar"><a class="btn secondary" href="/dashboard">חזרה לדשבורד</a></div></section>
<section class="tables"><article class="panel"><div class="panel-head"><h2>מצב החיבור</h2><span>נדרש מפתח Google</span></div><div class="empty" style="display:block;text-align:right"><p>תיקיית Drive הראשית כבר מוגדרת במערכת.</p><p>כדי לפתוח בקשת אישור אמיתית של Google צריך להוסיף למחשב הזה Client ID ו-Client Secret. אחרי זה הכפתור במערכת הראשית יפתח לך חלון אישור של Google.</p><p><strong>הרשאות מתוכננות:</strong> Drive ו-Sheets בלבד.</p></div></article>
<article class="panel"><div class="panel-head"><h2>מה יוקם בתיקייה</h2><span>אחסון פנימי בלבד</span></div><div class="wrap"><table><thead><tr><th>רכיב</th><th>מטרה</th></tr></thead><tbody><tr><td>מטופלים</td><td>תיקייה לכל מטופל</td></tr><tr><td>תבניות</td><td>תבניות מסמכים, סיכומים וקבלות</td></tr><tr><td>מערכת</td><td>קובץ clinic-manager-data ולוגים פנימיים</td></tr></tbody></table></div></article></section>`, "settings");
}

function patientsPage(error = "", success = "") {
  const patients = readPatients().sort((a, b) => a.child_name.localeCompare(b.child_name, "he"));
  const rows = patients.length
    ? patients.map((patient) => {
      const payload = encodeURIComponent(JSON.stringify({
        id: patient.id,
        child_name: patient.child_name || "",
        school_name: patient.school_name || "",
        treatment_type: patient.treatment_type || "",
        fixed_day: patient.fixed_day || "",
        fixed_time: patient.fixed_time || "",
        fixed_price: patient.fixed_price || "",
        general_notes: patient.general_notes || "",
        sensitive_notes: patient.sensitive_notes || ""
      }));

      return `<tr><td><div class="name">${escapeHtml(patient.child_name)}</div><div class="sub">כרטיס מטופל בסיסי</div></td><td>${escapeHtml(patient.treatment_type || "-")}</td><td>${escapeHtml([patient.fixed_day, patient.fixed_time].filter(Boolean).join(" ") || "-")}</td><td>${escapeHtml(patient.school_name || "-")}</td><td><span class="pill">פעיל</span></td><td><div class="actions"><a class="act" href="/patients/${encodeURIComponent(patient.id)}">פתח</a><button class="act edit" type="button" onclick="openPatientDrawer('${payload}')">ערוך</button><button class="act delete" type="button" onclick="openDeleteDialog('${encodeURIComponent(patient.id)}','${encodeURIComponent(patient.child_name || "")}')">מחק</button></div></td></tr>`;
    }).join("")
    : `<tr><td colspan="6"><div class="empty">עדיין אין מטופלים להצגה.</div></td></tr>`;

  return shell(`<section class="header"><div><p class="eyebrow">מטופלים</p><h1>רשימת מטופלים</h1><p>ניהול פרטים בסיסיים, מועדים קבועים וסטטוס לפני חיבור Google Sheets.</p></div></section>
<section class="toolbar-panel"><div class="toolbar"><button class="btn" onclick="openPatientDrawer()">הוסף מטופל +</button><button class="btn blue">ייבוא</button><button class="btn secondary">ייצוא</button><button class="btn yellow">סינון</button><button class="btn danger">נקה</button></div></section>
<section class="drawer" id="drawer" hidden><div class="drawer-inner"><div class="panel-head"><h2 id="drawerTitle">הוספת מטופל</h2><span>בהמשך יצירת מטופל תיצור גם תיקייה ב-Google Drive.</span></div><div class="body"><form id="patientForm" method="post" action="/patients"><div class="form-grid"><div><label for="child_name">שם הילד</label><input id="child_name" name="child_name" required></div><div><label for="school_name">מוסד לימודים</label><input id="school_name" name="school_name"></div><div><label for="treatment_type">סוג טיפול</label><input id="treatment_type" name="treatment_type"></div><div><label for="fixed_day">יום קבוע</label><input id="fixed_day" name="fixed_day"></div><div><label for="fixed_time">שעה קבועה</label><input id="fixed_time" name="fixed_time" type="time"></div><div><label for="fixed_price">מחיר קבוע</label><input id="fixed_price" name="fixed_price"></div><div class="wide"><label for="general_notes">הערות כלליות</label><textarea id="general_notes" name="general_notes"></textarea></div><div class="wide"><label for="sensitive_notes">הערות רגישות</label><textarea id="sensitive_notes" name="sensitive_notes"></textarea></div></div>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}${success ? `<div class="success">${escapeHtml(success)}</div>` : ""}<div class="toolbar"><button type="submit">שמירה</button><button class="btn secondary" type="button" onclick="document.getElementById('drawer').hidden=true">ביטול</button></div></form></div></div></section>
<section class="drawer" id="deleteDrawer" hidden><div class="confirm-dialog"><h2>מחיקת מטופל</h2><p>למחוק את <strong id="deleteName"></strong> מרשימת המטופלים?</p><p class="dialog-warning">הפעולה תמחק את הרשומה מהמערכת. תיקיית Drive של המטופל לא תימחק אוטומטית.</p><form id="deleteForm" method="post" action="/patients"><div class="toolbar"><button class="btn danger" type="submit">כן, למחוק</button><button class="btn secondary" type="button" onclick="document.getElementById('deleteDrawer').hidden=true">ביטול</button></div></form></div></section>
${success ? `<div class="success">${escapeHtml(success)}</div>` : ""}
<section class="panel"><div class="panel-head"><h2>מטופלים קיימים</h2><span>${patients.length} סה"כ</span></div><div class="wrap"><table><thead><tr><th>שם</th><th>סוג טיפול</th><th>יום ושעה קבועים</th><th>מוסד לימודים</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody><tr><td><input class="filter" placeholder="חפש שם"></td><td><input class="filter" placeholder="סוג טיפול"></td><td><input class="filter" placeholder="יום"></td><td></td><td></td><td><button class="act">נקה</button></td></tr>${rows}</tbody></table></div></section>
<script>
function setField(name, value) {
  const field = document.querySelector('[name="' + name + '"]');
  if (field) field.value = value || '';
}
function openPatientDrawer(payload) {
  const form = document.getElementById('patientForm');
  const title = document.getElementById('drawerTitle');
  const patient = payload ? JSON.parse(decodeURIComponent(payload)) : null;
  form.action = patient ? '/patients/' + encodeURIComponent(patient.id) + '/update' : '/patients';
  title.textContent = patient ? 'עריכת מטופל' : 'הוספת מטופל';
  for (const name of ['child_name','school_name','treatment_type','fixed_day','fixed_time','fixed_price','general_notes','sensitive_notes']) {
    setField(name, patient ? patient[name] : '');
  }
  document.getElementById('drawer').hidden = false;
}
function openDeleteDialog(id, name) {
  document.getElementById('deleteName').textContent = decodeURIComponent(name || '');
  document.getElementById('deleteForm').action = '/patients/' + encodeURIComponent(decodeURIComponent(id)) + '/delete';
  document.getElementById('deleteDrawer').hidden = false;
}
</script>`, "patients");
}

function detail(label, value) {
  return `<div class="detail"><span>${escapeHtml(label)}</span><strong>${valueOrDash(value)}</strong></div>`;
}

function formatDisplayDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
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

function paymentMethodLabel(value) {
  return {
    bank_transfer: "העברה",
    cash: "מזומן",
    check: "צ'ק"
  }[value] || "העברה";
}

function paymentStatusLabel(value) {
  return {
    paid: "שולם",
    partial: "חלקי",
    pending: "ממתין",
    unpaid: "פתוח"
  }[value] || "שולם";
}

function receiptStatusLabel(value) {
  return {
    issued: "הופקה",
    needed: "נדרשת",
    not_needed: "לא נדרש"
  }[value] || "נדרשת";
}

function sessionPanel(patient) {
  const sessions = readPatientSessions(patient.id);
  const rows = sessions.length
    ? `<div class="session-list">${sessions.slice(0, 5).map((session) => `<article class="session-item"><div><strong>${escapeHtml(formatDisplayDate(session.session_date))}</strong><span>${escapeHtml([session.start_time, session.end_time].filter(Boolean).join("-") || "ללא שעה")}</span></div><div><strong>${escapeHtml(session.session_type || "מפגש")}</strong><span>${escapeHtml(session.location || "ללא מיקום")}</span></div><p>${escapeHtml(session.summary || "לא נכתב סיכום.")}</p></article>`).join("")}</div>`
    : `<div class="empty">עדיין אין מפגשים בכרטיס.</div>`;

  return `<div class="panel"><div class="panel-head"><h2>מפגשים</h2><span>תיעוד טיפולי והיסטוריית מפגשים</span></div><form class="session-form" method="post" action="/patients/${encodeURIComponent(patient.id)}/sessions"><div class="form-grid"><div><label for="session_date">תאריך</label><input id="session_date" name="session_date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div><div><label for="start_time">משעה</label><input id="start_time" name="start_time" type="time"></div><div><label for="end_time">עד שעה</label><input id="end_time" name="end_time" type="time"></div><div><label for="location">מיקום</label><input id="location" name="location"></div><div><label for="session_type">סוג מפגש</label><input id="session_type" name="session_type"></div><div class="wide"><label for="summary">סיכום מפגש</label><textarea id="summary" name="summary"></textarea></div><div class="wide"><label for="sensitive_notes">הערות רגישות</label><textarea id="sensitive_notes" name="sensitive_notes"></textarea></div></div><div class="toolbar"><button type="submit">שמירת מפגש</button></div></form>${rows}</div>`;
}

function paymentPanel(patient) {
  const payments = readPatientPayments(patient.id);
  const rows = payments.length
    ? `<div class="payment-list">${payments.slice(0, 5).map((payment) => `<article class="payment-item"><div><strong>${escapeHtml(formatAmount(payment.amount))}</strong><span>${escapeHtml(formatDisplayDate(payment.paid_at))}</span></div><div><strong>${escapeHtml(paymentMethodLabel(payment.payment_method))}</strong><span>${escapeHtml(paymentStatusLabel(payment.payment_status))}</span></div><div><span class="payment-pill">${escapeHtml(receiptStatusLabel(payment.receipt_status))}</span></div><p>${escapeHtml(payment.notes || "ללא הערות.")}</p></article>`).join("")}</div>`
    : `<div class="empty">עדיין אין תשלומים בכרטיס.</div>`;

  return `<div class="panel"><div class="panel-head"><h2>תשלומים</h2><span>מעקב גבייה וקבלות</span></div><form class="payment-form" method="post" action="/patients/${encodeURIComponent(patient.id)}/payments"><div class="form-grid"><div><label for="amount">סכום</label><input id="amount" name="amount" inputmode="decimal" required></div><div><label for="paid_at">תאריך</label><input id="paid_at" name="paid_at" type="date" value="${new Date().toISOString().slice(0, 10)}"></div><div><label for="payment_method">אמצעי</label><select id="payment_method" name="payment_method"><option value="bank_transfer">העברה</option><option value="cash">מזומן</option><option value="check">צ'ק</option></select></div><div><label for="payment_status">סטטוס</label><select id="payment_status" name="payment_status"><option value="paid">שולם</option><option value="partial">חלקי</option><option value="pending">ממתין</option><option value="unpaid">פתוח</option></select></div><div><label for="receipt_status">קבלה</label><select id="receipt_status" name="receipt_status"><option value="needed">נדרשת</option><option value="issued">הופקה</option><option value="not_needed">לא נדרש</option></select></div><div class="wide"><label for="notes">הערות</label><textarea id="notes" name="notes"></textarea></div></div><div class="toolbar"><button type="submit">שמירת תשלום</button></div></form>${rows}</div>`;
}

function patientProfilePage(patient) {
  const fixedSchedule = [patient.fixed_day, patient.fixed_time].filter(Boolean).join(" ");
  const content = `<section class="profile">
    <div class="profile-hero"><div><p class="eyebrow">כרטיס מטופל</p><h1>${escapeHtml(patient.child_name)}</h1><p>${valueOrDash(patient.treatment_type)} | ${escapeHtml(fixedSchedule || "לא הוגדר מועד קבוע")}</p></div><div class="profile-actions"><a class="btn secondary" href="/patients">חזרה לרשימה</a><button class="btn">עריכת פרטים</button></div></div>
    <section class="mini-grid"><article class="mini"><span>סטטוס טיפול</span><strong>פעיל</strong></article><article class="mini"><span>תשלום</span><strong>${patient.payment_status === "paid" ? "שולם" : "פתוח"}</strong></article><article class="mini"><span>קבלה</span><strong>${patient.receipt_status === "issued" ? "הופקה" : "נדרש"}</strong></article><article class="mini"><span>מחיר קבוע</span><strong>${valueOrDash(patient.fixed_price)}</strong></article></section>
    <section class="profile-grid"><div class="panel"><div class="panel-head"><h2>פרטים כלליים</h2><span>מידע בסיסי לעבודה שוטפת</span></div><div class="detail-grid">${detail("שם", patient.child_name)}${detail("מוסד לימודים", patient.school_name)}${detail("כתובת", patient.address)}${detail("סוג טיפול", patient.treatment_type)}${detail("יום קבוע", patient.fixed_day)}${detail("שעה קבועה", patient.fixed_time)}</div></div>
    <div class="panel"><div class="panel-head"><h2>תיעוד והערות</h2><span>רגיש נשאר בתוך המערכת בלבד</span></div><div class="notes"><article class="note"><h3>מטרות טיפול</h3><p>${valueOrDash(patient.treatment_goals)}</p></article><article class="note"><h3>הערות כלליות</h3><p>${valueOrDash(patient.general_notes)}</p></article><article class="note sensitive"><h3>הערות רגישות</h3><p>${valueOrDash(patient.sensitive_notes)}</p></article></div></div></section>
    <section class="profile-grid three">${sessionPanel(patient)}${paymentPanel(patient)}<div class="panel"><div class="panel-head"><h2>קבצים</h2><span>Google Drive בהמשך</span></div><div class="empty">תיקיית Drive תתחבר בשלב הבא.</div></div></section>
  </section>`;
  return shell(content, "patients");
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/login" && request.method === "GET") {
    if (hasSession(request)) {
      response.writeHead(303, { Location: "/dashboard" });
      response.end();
      return;
    }

    send(response, 200, loginPage());
    return;
  }

  if (url.pathname === "/login" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const password = new URLSearchParams(body).get("password") || "";

      if (!safeCompare(sha256(password), passwordHash)) {
        send(response, 401, loginPage("הכניסה נכשלה. בדקו את הסיסמה ונסו שוב."));
        return;
      }

      response.writeHead(303, {
        Location: "/dashboard",
        "Set-Cookie": `${sessionCookieName}=${createSession()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`
      });
      response.end();
    });
    return;
  }

  if (url.pathname === "/logout" && request.method === "POST") {
    response.writeHead(303, {
      Location: "/login",
      "Set-Cookie": `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    });
    response.end();
    return;
  }

  if (url.pathname === "/patients" && request.method === "POST") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        createPatient(new URLSearchParams(body));
        send(response, 200, patientsPage("", "המטופל נשמר במערכת המקומית."));
      } catch (error) {
        send(response, 400, patientsPage(error instanceof Error ? error.message : "לא ניתן היה לשמור מטופל.", ""));
      }
    });
    return;
  }

  if (url.pathname === "/patients") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    send(response, 200, patientsPage());
    return;
  }

  if (url.pathname.match(/^\/patients\/[^/]+\/update$/) && request.method === "POST") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    const patientId = decodeURIComponent(url.pathname.split("/")[2]);
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        updatePatient(patientId, new URLSearchParams(body));
        send(response, 200, patientsPage("", "פרטי המטופל עודכנו."));
      } catch (error) {
        send(response, 400, patientsPage(error instanceof Error ? error.message : "לא ניתן היה לעדכן מטופל.", ""));
      }
    });
    return;
  }

  if (url.pathname.match(/^\/patients\/[^/]+\/delete$/) && request.method === "POST") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    try {
      deletePatient(decodeURIComponent(url.pathname.split("/")[2]));
      send(response, 200, patientsPage("", "המטופל נמחק מהרשימה."));
    } catch (error) {
      send(response, 400, patientsPage(error instanceof Error ? error.message : "לא ניתן היה למחוק מטופל.", ""));
    }
    return;
  }

  if (url.pathname.match(/^\/patients\/[^/]+\/sessions$/) && request.method === "POST") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    const patientId = decodeURIComponent(url.pathname.split("/")[2]);
    if (!getPatient(patientId)) {
      send(response, 404, shell(`<section class="header"><div><p class="eyebrow">מטופלים</p><h1>הכרטיס לא נמצא</h1><p>ייתכן שהמטופל נמחק או שהקישור לא תקין.</p></div><div class="toolbar"><a class="btn secondary" href="/patients">חזרה לרשימה</a></div></section>`, "patients"));
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        createTreatmentSession(patientId, new URLSearchParams(body));
        response.writeHead(303, { Location: `/patients/${encodeURIComponent(patientId)}` });
        response.end();
      } catch (error) {
        send(response, 400, shell(`<section class="header"><div><p class="eyebrow">מפגשים</p><h1>לא ניתן היה לשמור מפגש</h1><p>${escapeHtml(error instanceof Error ? error.message : "בדקו את הפרטים ונסו שוב.")}</p></div><div class="toolbar"><a class="btn secondary" href="/patients/${encodeURIComponent(patientId)}">חזרה לכרטיס</a></div></section>`, "patients"));
      }
    });
    return;
  }

  if (url.pathname.match(/^\/patients\/[^/]+\/payments$/) && request.method === "POST") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    const patientId = decodeURIComponent(url.pathname.split("/")[2]);
    if (!getPatient(patientId)) {
      send(response, 404, shell(`<section class="header"><div><p class="eyebrow">מטופלים</p><h1>הכרטיס לא נמצא</h1><p>ייתכן שהמטופל נמחק או שהקישור לא תקין.</p></div><div class="toolbar"><a class="btn secondary" href="/patients">חזרה לרשימה</a></div></section>`, "patients"));
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        createPayment(patientId, new URLSearchParams(body));
        response.writeHead(303, { Location: `/patients/${encodeURIComponent(patientId)}` });
        response.end();
      } catch (error) {
        send(response, 400, shell(`<section class="header"><div><p class="eyebrow">תשלומים</p><h1>לא ניתן היה לשמור תשלום</h1><p>${escapeHtml(error instanceof Error ? error.message : "בדקו את הפרטים ונסו שוב.")}</p></div><div class="toolbar"><a class="btn secondary" href="/patients/${encodeURIComponent(patientId)}">חזרה לכרטיס</a></div></section>`, "patients"));
      }
    });
    return;
  }

  if (url.pathname.startsWith("/patients/")) {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    const patient = getPatient(decodeURIComponent(url.pathname.replace("/patients/", "")));
    if (!patient) {
      send(response, 404, shell(`<section class="header"><div><p class="eyebrow">מטופלים</p><h1>הכרטיס לא נמצא</h1><p>ייתכן שהמטופל נמחק או שהקישור לא תקין.</p></div><div class="toolbar"><a class="btn secondary" href="/patients">חזרה לרשימה</a></div></section>`, "patients"));
      return;
    }

    send(response, 200, patientProfilePage(patient));
    return;
  }

  if (url.pathname === "/dashboard") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    send(response, 200, dashboardPage());
    return;
  }

  if (url.pathname === "/settings") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    send(response, 200, settingsPage());
    return;
  }

  response.writeHead(303, { Location: hasSession(request) ? "/dashboard" : "/login" });
  response.end();
});

server.listen(port, () => {
  console.log(`Clinic manager is running at http://localhost:${port}`);
});
