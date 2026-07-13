import fs from "fs";

const app = fs.readFileSync("docs/app.js", "utf8");
const index = fs.readFileSync("docs/index.html", "utf8");

const checks = [
  [
    "Content Security Policy",
    index.includes('http-equiv="Content-Security-Policy"') &&
      index.includes("object-src 'none'") &&
      index.includes("base-uri 'self'")
  ],
  ["No referrer leakage", index.includes('name="referrer" content="no-referrer"')],
  [
    "Google access token is session-only",
    app.includes("sessionStorage.setItem(GOOGLE_TOKEN_KEY, payload)") &&
      !app.includes("localStorage.setItem(GOOGLE_TOKEN_KEY, payload)")
  ],
  ["Empty allowlist denies access", app.includes("if (!allowedEmails.length) return false")],
  ["Verified Google email required", app.includes("profile?.email_verified !== true")],
  ["Automatic session restoration", app.includes("async function restoreGoogleSession()")],
  ["Explicit device disconnect", app.includes('action === "disconnect-google"')],
  ["Public Drive access audit", app.includes("async function runSharingSecurityAudit()")],
  [
    "Automatic public permission removal",
    app.includes("async function repairSharingSecurity()") &&
      app.includes('permission.type === "anyone"') &&
      app.includes("const removedPublicPermissions = await repairSharingSecurity()")
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

if (failed) process.exitCode = 1;
