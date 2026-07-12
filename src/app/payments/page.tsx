import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function PaymentsPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">תשלומים</p>
            <h1>מעקב תשלומים</h1>
            <p>
              תשלומים כבר נשמרים מתוך כרטיס המטופל. מסך מרכזי לכל התשלומים
              עדיין ממתין לשלב הבא.
            </p>
          </div>
          <div className="header-actions">
            <Link className="toolbar-button primary" href="/patients">
              פתיחת כרטיס מטופל
            </Link>
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h2>מה עובד עכשיו</h2>
            <span>רישום תשלום בכרטיס מטופל</span>
          </div>
          <div className="empty-state">
            כדי לרשום תשלום יש לפתוח מטופל ולהשתמש באזור התשלומים בכרטיס שלו.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
