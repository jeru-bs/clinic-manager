import fs from "fs";
import path from "path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "work", "outputs", ".agents"]);
const textExtensions = new Set([".js", ".mjs", ".css", ".md", ".json", ".html"]);
const textFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(fullPath);

    if (textExtensions.has(extension)) textFiles.push(fullPath);
  }
}

walk(root);

const mojibakeFiles = [];
const suspiciousSecretFiles = [];
const uiRegressionFindings = [];
const secretPatterns = [
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /ya29\./,
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/
];

for (const file of textFiles) {
  const content = fs.readFileSync(file, "utf8");

  if (content.includes("\u05f3")) {
    mojibakeFiles.push(path.relative(root, file));
  }

  if (secretPatterns.some((pattern) => pattern.test(content))) {
    suspiciousSecretFiles.push(path.relative(root, file));
  }
}

const browserAppSource = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");
const browserCssSource = fs.readFileSync(path.join(root, "docs", "app.css"), "utf8");
const browserHtmlSource = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");

if (!browserAppSource.includes("daySessions.length > 1")) {
  uiRegressionFindings.push("calendar does not reveal additional sessions from the second meeting onward");
}
if (!browserAppSource.includes('error_callback: (error) =>')) {
  uiRegressionFindings.push("Google popup failures are not handled");
}
if (browserAppSource.includes('חשבונות מורשים: ${allowedEmails.join')) {
  uiRegressionFindings.push("the public access gate exposes authorized email addresses");
}
if (!browserAppSource.includes('role="dialog" aria-modal="true"')) {
  uiRegressionFindings.push("the patient drawer is not exposed as an accessible dialog");
}
if (!browserCssSource.includes(".calendar-mobile-count") || !browserCssSource.includes("height: 72px")) {
  uiRegressionFindings.push("mobile calendar or bottom navigation styles are missing");
}
if (
  !browserAppSource.includes('i: "on"') ||
  !browserAppSource.includes('lg: "he"') ||
  !browserAppSource.includes("israelHolidayBlocksRecurring") ||
  !browserHtmlSource.includes("https://www.hebcal.com")
) {
  uiRegressionFindings.push("the Israel holiday integration is incomplete");
}
if (
  !browserAppSource.includes("function privateCalendarEventBody(session)") ||
  !browserAppSource.includes('summary: "פגישה בקליניקה"') ||
  !browserAppSource.includes('visibility: "private"') ||
  !browserAppSource.includes('description: ""')
) {
  uiRegressionFindings.push("calendar events can expose patient or treatment details");
}
if (
  !browserAppSource.includes("function queueSyncWork(") ||
  !browserAppSource.includes("async function processSyncQueue(") ||
  !browserAppSource.includes("SYNC_QUEUE_KEY") ||
  !browserAppSource.includes('data-action="retry-sync"')
) {
  uiRegressionFindings.push("persistent retryable synchronization is missing");
}
if (
  !browserAppSource.includes("uploadType=resumable") ||
  !browserAppSource.includes("Content-Range") ||
  !browserAppSource.includes("updateUploadProgress") ||
  !browserAppSource.includes('"cancel-upload": async')
) {
  uiRegressionFindings.push("resumable upload progress or cancellation is missing");
}
if (
  !browserAppSource.includes("contacts: [") ||
  !browserAppSource.includes('data-form="contact"') ||
  !browserAppSource.includes("async function saveContact(") ||
  !browserAppSource.includes("async function deleteContactRecord(")
) {
  uiRegressionFindings.push("parent and professional contact management is incomplete");
}
if (
  !browserAppSource.includes("goals: [") ||
  !browserAppSource.includes('data-form="goal"') ||
  !browserAppSource.includes("async function saveSessionGoalUpdates(") ||
  !browserAppSource.includes("async function migrateLegacyGoals(")
) {
  uiRegressionFindings.push("structured treatment goals or legacy migration are incomplete");
}
if (
  !browserAppSource.includes("questionnaire_templates: [") ||
  !browserAppSource.includes("https://forms.googleapis.com/v1/forms") ||
  !browserAppSource.includes("async function syncQuestionnaireAssignment(") ||
  !browserAppSource.includes("forms.responses.readonly")
) {
  uiRegressionFindings.push("Google Forms questionnaires or response import are incomplete");
}
if (
  !browserAppSource.includes("clinical_reports: [") ||
  !browserAppSource.includes('data-form="clinical-report"') ||
  !browserAppSource.includes("async function createClinicalReport(") ||
  !browserAppSource.includes("application/pdf")
) {
  uiRegressionFindings.push("clinical Google Doc and PDF reports are incomplete");
}

const checks = [
  ["Mojibake marker", mojibakeFiles],
  ["Obvious secret values", suspiciousSecretFiles],
  ["QA regression contracts", uiRegressionFindings]
];

let failed = false;

for (const [label, findings] of checks) {
  if (findings.length) {
    failed = true;
    console.error(`${label}:`);
    console.error(findings.join("\n"));
  } else {
    console.log(`${label}: ok`);
  }
}

if (failed) {
  process.exitCode = 1;
}
