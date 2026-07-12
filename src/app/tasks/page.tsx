import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function TasksPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">משימות</p>
            <h1>ניהול משימות</h1>
            <p>
              שכבת המשימות קיימת בתכנון האחסון ב-Google Sheets, אבל מסך העבודה
              המלא עדיין לא נבנה בגרסת Next.
            </p>
          </div>
          <div className="header-actions">
            <Link className="toolbar-button secondary" href="/dashboard">
              חזרה לדשבורד
            </Link>
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h2>השלב הבא במסך הזה</h2>
            <span>רשימה, סטטוסים ותאריכי יעד</span>
          </div>
          <div className="empty-state">
            השלב הבא הוא להוסיף CRUD למשימות ולקשר אותן למטופלים ולמפגשים.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
