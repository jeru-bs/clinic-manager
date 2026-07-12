import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  getGoogleConnectionStatus,
  type GoogleConnectionStatus
} from "@/lib/google-oauth";
import {
  GOOGLE_DRIVE_ROOT_FOLDER_URL,
  googleWorkspaceFolders,
  googleWorkspaceSpreadsheet
} from "@/lib/google-workspace";
import { getProvisioningStatus } from "@/lib/google-provisioning";

function formatDate(value?: string): string {
  if (!value) return "עדיין לא בוצע חיבור";

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function messageForGoogleStatus(status: string | undefined): string | null {
  switch (status) {
    case "connected":
      return "החיבור ל-Google נשמר בהצלחה.";
    case "disconnected":
      return "החיבור ל-Google נותק מהמחשב הזה.";
    case "provisioned":
      return "תיקיות העבודה וקובץ Google Sheets הוקמו בתיקיית הדרייב.";
    case "missing-config":
      return "חסרים פרטי Client ID ו-Client Secret בקובץ ההגדרות המקומי.";
    case "not-connected":
      return "צריך להתחבר ל-Google לפני הקמת התיקיות והטבלה.";
    case "denied":
      return "האישור ב-Google בוטל.";
    case "invalid":
    case "failed":
    case "provision-failed":
      return "לא הצלחנו להשלים את החיבור. אפשר לנסות שוב אחרי בדיקת פרטי Google.";
    default:
      return null;
  }
}

function GoogleStatusBadge({ status }: { status: GoogleConnectionStatus }) {
  if (!status.configured) {
    return <span className="status-pill warning">נדרש מפתח Google</span>;
  }

  return (
    <span className={status.connected ? "status-pill success" : "status-pill"}>
      {status.connected ? "מחובר" : "מוכן לחיבור"}
    </span>
  );
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ google?: string }>;
}): Promise<React.ReactElement> {
  const status = await getGoogleConnectionStatus();
  const provisioning = await getProvisioningStatus();
  const params = await searchParams;
  const message = messageForGoogleStatus(params?.google);

  return (
    <AppShell>
      <div className="page">
        <section className="page-header">
          <div className="page-title">
            <p className="eyebrow">הגדרות מערכת</p>
            <h1>חיבור Google Drive ו-Sheets</h1>
            <p>הדרייב משמש לאחסון בלבד. הנתונים יוצגו במערכת מתוך Google Sheets.</p>
          </div>
          <div className="header-actions">
            <Link className="toolbar-button secondary" href="/dashboard">
              חזרה לדשבורד
            </Link>
          </div>
        </section>

        {message ? <div className="form-success settings-message">{message}</div> : null}

        <section className="settings-grid">
          <article className="panel-section settings-card">
            <div className="section-heading">
              <h2>מצב החיבור</h2>
              <GoogleStatusBadge status={status} />
            </div>
            <div className="settings-body">
              <dl className="settings-details">
                <div>
                  <dt>תיקיית Drive ראשית</dt>
                  <dd>
                    <a href={GOOGLE_DRIVE_ROOT_FOLDER_URL} rel="noreferrer" target="_blank">
                      {status.rootFolderId}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>חובר לאחרונה</dt>
                  <dd>{formatDate(status.connectedAt)}</dd>
                </div>
                <div>
                  <dt>הרשאות</dt>
                  <dd>Drive ו-Sheets בלבד</dd>
                </div>
                <div>
                  <dt>הקמת אחסון</dt>
                  <dd>
                    {provisioning.provisioned
                      ? `בוצע ב-${formatDate(provisioning.updatedAt)}`
                      : "עדיין לא הוקמו תיקיות וטבלה"}
                  </dd>
                </div>
              </dl>

              {!status.configured ? (
                <div className="form-error">
                  כדי לפתוח בקשת אישור של Google צריך להוסיף למחשב הזה את
                  GOOGLE_CLIENT_ID ואת GOOGLE_CLIENT_SECRET.
                </div>
              ) : null}

              <div className="toolbar">
                <Link
                  className={status.configured ? "toolbar-button primary" : "toolbar-button secondary"}
                  href={status.configured ? "/api/google/connect" : "#"}
                  aria-disabled={!status.configured}
                >
                  {status.connected ? "חיבור מחדש ל-Google" : "חבר את Google"}
                </Link>
                {status.connected ? (
                  <>
                    <form action="/api/google/provision" method="post">
                      <button className="toolbar-button blue" type="submit">
                        הקם תיקיות וטבלה
                      </button>
                    </form>
                    <form action="/api/google/disconnect" method="post">
                      <button className="toolbar-button danger" type="submit">
                        ניתוק חיבור
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          </article>

          <article className="panel-section settings-card">
            <div className="section-heading">
              <h2>מה יוקם בתיקייה</h2>
              <span>לא מוצג בדשבורד</span>
            </div>
            <div className="settings-body">
              <div className="folder-list">
                {googleWorkspaceFolders.map((folder) => (
                  <div key={folder.key}>
                    <strong>{folder.name}</strong>
                    <span>{folder.description}</span>
                  </div>
                ))}
              </div>
              <div className="sheet-summary">
                <strong>{googleWorkspaceSpreadsheet.name}</strong>
                <span>
                  קובץ Google Sheets פנימי עם {googleWorkspaceSpreadsheet.sheets.length} לשוניות
                  לניהול מטופלים, מפגשים, תשלומים, משימות וקבצים.
                </span>
              </div>
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
