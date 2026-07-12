import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function FilesPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">קבצים</p>
            <h1>קבצי מטופלים</h1>
            <p>
              תיקיות המטופלים מוקמות ב-Google Drive לאחר חיבור והקמת סביבת
              Google. העלאת קבצים מתוך גרסת Next עדיין לא מחוברת.
            </p>
          </div>
          <div className="header-actions">
            <Link className="toolbar-button primary" href="/settings">
              הגדרות Google
            </Link>
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h2>מה עובד עכשיו</h2>
            <span>הקמת תיקיות ב-Drive</span>
          </div>
          <div className="empty-state">
            לאחר חיבור Google והקמת סביבת העבודה, לכל מטופל חדש נוצרת תיקייה
            בדרייב.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
