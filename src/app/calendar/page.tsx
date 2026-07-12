import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function CalendarPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">יומן</p>
            <h1>יומן מפגשים</h1>
            <p>
              תצוגת היומן המלאה עדיין לא מחוברת בגרסת Next. בינתיים אפשר
              לתעד מפגשים מתוך כרטיס המטופל.
            </p>
          </div>
          <div className="header-actions">
            <Link className="toolbar-button primary" href="/patients">
              מעבר למטופלים
            </Link>
          </div>
        </section>

        <section className="data-panel">
          <div className="panel-heading">
            <h2>מה עובד עכשיו</h2>
            <span>תיעוד מפגשים לפי מטופל</span>
          </div>
          <div className="empty-state">
            לפתיחת מפגש חדש יש לבחור מטופל, לפתוח את הכרטיס שלו, ולהוסיף מפגש
            באזור המפגשים.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
