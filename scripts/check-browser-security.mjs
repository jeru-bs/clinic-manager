import fs from "fs";

const app = fs.readFileSync("docs/app.js", "utf8");
const core = fs.readFileSync("docs/workflow-core.js", "utf8");
const index = fs.readFileSync("docs/index.html", "utf8");

const csp = index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1] || "";
const cspDirective = (name) => csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) || "";

// Record/user/API text fields interpolated straight into HTML markup without html().
const TEXT_FIELDS = "reason|summary|notes|name|title|description|email|phone|child_name|file_name|subject|label";
const unescapedTextFields = app.split("\n").flatMap((line, index) => {
  if (!/<[a-z]/i.test(line)) return [];
  const pattern = new RegExp(`\\$\\{\\s*[\\w?.]+\\.(?:${TEXT_FIELDS})\\s*\\}`, "g");
  return [...line.matchAll(pattern)].map((match) => `line ${index + 1}: ${match[0]}`);
});

// URLs that come from the sheet or from Google must reach an href through safeHref().
const unguardedHrefs = [...app.matchAll(/href="\$\{html\((?!safeHref\(|driveFileUrl\(|driveFolderUrl\(|google\w+Url\()[^)]*\.(?:url|file_url|responder_url|link)\b[^}]*\}"/g)].map(
  (match) => match[0]
);

const inlineStyleAttributes = [...app.matchAll(/\sstyle="/g)].map(() => "style attribute in generated markup");

const checks = [
  [
    "Content Security Policy",
    index.includes('http-equiv="Content-Security-Policy"') &&
      index.includes("object-src 'none'") &&
      index.includes("base-uri 'self'") &&
      index.includes("https://forms.googleapis.com") &&
      index.includes("https://docs.googleapis.com")
  ],
  ["CSP style-src forbids inline styles", cspDirective("style-src") === "style-src 'self'"],
  ["CSP img-src limited to local, data and blob images", cspDirective("img-src") === "img-src 'self' data: blob:"],
  ["No inline style attributes in generated markup", inlineStyleAttributes.length === 0],
  ["No referrer leakage", index.includes('name="referrer" content="no-referrer"')],
  [
    "Google access token is session-only",
    app.includes("sessionStorage.setItem(GOOGLE_TOKEN_KEY, payload)") &&
      !app.includes("localStorage.setItem(GOOGLE_TOKEN_KEY, payload)")
  ],
  ["Empty allowlist denies access", app.includes("if (!allowedEmails.length) return false")],
  ["Verified Google email required", app.includes("profile?.email_verified !== true")],
  ["Automatic session restoration", app.includes("async function restoreGoogleSession()")],
  ["Explicit device disconnect", app.includes('"disconnect-google": async')],
  [
    "Sensitive state cleared on disconnect and auth failure",
    app.includes("function clearClinicData()") &&
      app.includes("state.auditLog = []") &&
      app.includes("clearClinicData();")
  ],
  ["Public Drive access audit", app.includes("async function runSharingSecurityAudit()")],
  [
    "Automatic public permission removal",
    app.includes("async function repairSharingSecurity()") &&
      core.includes('permission.type === "anyone"') &&
      app.includes("const removedPublicPermissions = await repairSharingSecurity()")
  ],
  [
    "Public files under the clinic folders are found and repaired",
    app.includes("visibility = 'anyoneWithLink'") &&
      app.includes("async function isUnderClinicFolders(") &&
      app.includes("WorkflowCore.classifySharingPermissions(")
  ],
  [
    "Foreign user and domain shares are reported",
    core.includes("function classifySharingPermissions(") &&
      core.includes('permission.type === "domain"') &&
      app.includes("data-sharing-warning")
  ],
  [
    "Config overrides are whitelisted and googleClientId comes only from config.js",
    core.includes("function pickOverridableConfig(") &&
      !core.match(/OVERRIDABLE_CONFIG_KEYS = \[[^\]]*googleClientId/) &&
      (app.match(/WorkflowCore\.pickOverridableConfig\(/g) || []).length >= 4 &&
      app.includes('googleClientId: configDefaults.googleClientId || ""') &&
      !app.includes("saved.googleClientId") &&
      !app.includes("...remoteConfig")
  ],
  ["Record text fields are HTML-escaped", unescapedTextFields.length === 0],
  ["Sheet and Drive URLs pass through safeHref", core.includes("function safeHref(") && unguardedHrefs.length === 0],
  ["Drive ids are URL-encoded in links", app.includes("https://drive.google.com/file/d/${encodeURIComponent(")],
  [
    "Backups exclude the audit log",
    core.includes('BACKUP_EXCLUDED_TABLES = ["audit_log"]') &&
      !app.includes("audit_log: state.auditLog") &&
      app.includes("WorkflowCore.backupTables(")
  ],
  [
    "Private calendar events without patient data",
    app.includes("function privateCalendarEventBody(session)") &&
      app.includes('summary: "פגישה בקליניקה"') &&
      app.includes('description: ""') &&
      app.includes('visibility: "private"') &&
      app.includes("queueCalendarPrivacyMigration()")
  ]
];

let failed = false;
for (const [label, passed] of checks) {
  if (passed) {
    console.log(`${label}: ok`);
  } else {
    failed = true;
    console.error(`${label}: missing`);
  }
}
for (const finding of [...unescapedTextFields, ...unguardedHrefs]) console.error(`  ${finding}`);

if (failed) process.exitCode = 1;
