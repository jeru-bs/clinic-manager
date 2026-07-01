import { createHmac, createHash, timingSafeEqual } from "crypto";
import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve } from "path";

const port = Number(process.env.PORT || 3000);
const envPath = resolve(".env.local");

function loadEnvFile() {
  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) {
      process.env[match[1]] ||= match[2];
    }
  }
}

loadEnvFile();

const appName = process.env.NEXT_PUBLIC_APP_NAME || "ניהול קליניקה";
const passwordHash = process.env.APP_PASSWORD_HASH || "";
const sessionSecret = process.env.SESSION_SECRET || "";
const sessionCookieName = "clinic_session";

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
  const payload = Buffer.from(
    JSON.stringify({ createdAt: Date.now() }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function hasSession(request) {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.split("=")[1];

  if (!token) {
    return false;
  }

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

function layout(body) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${appName}</title>
  <style>
    :root { --bg:#f6f7f4; --card:#fff; --text:#17211c; --muted:#66736d; --border:#d8e0dc; --primary:#166b5b; --warn:#fffaf2; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:Arial, system-ui, sans-serif; }
    button,input { font:inherit; }
    .center { min-height:100vh; display:grid; place-items:center; padding:24px; }
    .panel,.card { background:var(--card); border:1px solid var(--border); border-radius:8px; box-shadow:0 16px 45px rgba(23,33,28,.08); }
    .panel { width:min(100%,430px); padding:28px; }
    .eyebrow { color:var(--primary); font-weight:800; margin:0 0 10px; }
    h1 { margin:0; font-size:2.2rem; line-height:1.15; }
    p { color:var(--muted); }
    form { display:grid; gap:14px; margin-top:24px; }
    label { font-weight:800; }
    input { width:100%; min-height:46px; border:1px solid var(--border); border-radius:8px; padding:0 12px; }
    button { min-height:44px; border:0; border-radius:8px; background:var(--primary); color:#fff; font-weight:800; padding:0 18px; cursor:pointer; }
    .error { border:1px solid rgba(180,35,24,.24); border-radius:8px; background:#fff3f1; color:#b42318; padding:10px 12px; }
    header { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px clamp(18px,4vw,44px); border-bottom:1px solid var(--border); }
    .brand { font-weight:900; }
    main { width:min(1160px,100%); margin:0 auto; padding:34px clamp(18px,4vw,44px) 76px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:28px; }
    .card { min-height:144px; padding:18px; box-shadow:none; }
    .card strong { display:block; margin-top:16px; font-size:2rem; }
    .sync { background:var(--warn); }
    .wide { grid-column:span 2; }
    .empty { display:grid; min-height:170px; place-items:center; border:1px dashed var(--border); border-radius:8px; color:var(--muted); text-align:center; padding:18px; }
    .plus { position:fixed; left:28px; bottom:28px; width:58px; height:58px; border-radius:50%; font-size:2rem; }
    .logout { background:#fff; color:var(--text); border:1px solid var(--border); }
    @media (max-width:900px){ .grid{grid-template-columns:repeat(2,minmax(0,1fr));} }
    @media (max-width:620px){ header{align-items:stretch; flex-direction:column;} .grid{grid-template-columns:1fr;} .wide{grid-column:auto;} }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function loginPage(error = "") {
  return layout(`<main class="center">
  <section class="panel">
    <p class="eyebrow">מערכת פרטית</p>
    <h1>${appName}</h1>
    <p>כניסה מאובטחת לניהול הקליניקה.</p>
    <form method="post" action="/login">
      <label for="password">סיסמה</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus />
      ${error ? `<div class="error">${error}</div>` : ""}
      <button type="submit">כניסה</button>
    </form>
  </section>
</main>`);
}

function dashboardPage() {
  return layout(`<header>
  <div class="brand">${appName}</div>
  <form method="post" action="/logout"><button class="logout" type="submit">יציאה</button></form>
</header>
<main>
  <p class="eyebrow">תמונת מצב יומית</p>
  <h1>דשבורד</h1>
  <p>כאן יוצגו המפגשים, המשימות, התשלומים והתראות הסנכרון.</p>
  <section class="grid">
    <div class="card"><h2>מפגשים היום</h2><strong>0</strong><p>יופיעו לאחר חיבור היומן הפנימי.</p></div>
    <div class="card"><h2>משימות פתוחות</h2><strong>0</strong><p>משימות ותזכורות יתווספו בשלבי ה-CRUD.</p></div>
    <div class="card"><h2>תשלומים פתוחים</h2><strong>0</strong><p>יוצג לאחר הוספת ניהול תשלומים.</p></div>
    <div class="card sync"><h2>התראות סנכרון</h2><strong>0</strong><p>כשלים מול Google יישארו כאן עד טיפול.</p></div>
    <div class="card wide"><h2>מפגשים קרובים</h2><div class="empty">עדיין אין מפגשים להצגה.</div></div>
    <div class="card wide"><h2>פעולות להמשך</h2><div class="empty">בשלב הבא יתווספו מטופלים, אירועים ותיעוד.</div></div>
  </section>
  <button class="plus" type="button" title="פעולות מהירות יתווספו בשלב הבא">+</button>
</main>`);
}

const server = createServer((request, response) => {
  if (request.url === "/login" && request.method === "GET") {
    if (hasSession(request)) {
      response.writeHead(303, { Location: "/dashboard" });
      response.end();
      return;
    }

    send(response, 200, loginPage());
    return;
  }

  if (request.url === "/login" && request.method === "POST") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const params = new URLSearchParams(body);
      const password = params.get("password") || "";

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

  if (request.url === "/logout" && request.method === "POST") {
    response.writeHead(303, {
      Location: "/login",
      "Set-Cookie": `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    });
    response.end();
    return;
  }

  if (request.url === "/dashboard") {
    if (!hasSession(request)) {
      response.writeHead(303, { Location: "/login" });
      response.end();
      return;
    }

    send(response, 200, dashboardPage());
    return;
  }

  response.writeHead(303, { Location: hasSession(request) ? "/dashboard" : "/login" });
  response.end();
});

server.listen(port, () => {
  console.log(`Clinic manager is running at http://localhost:${port}`);
});
