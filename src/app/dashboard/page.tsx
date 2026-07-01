import { AppShell } from "@/components/AppShell";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { StatusCard } from "@/components/StatusCard";

export default function DashboardPage(): React.ReactElement {
  return (
    <AppShell>
      <section className="page-header">
        <div className="page-title">
          <p className="eyebrow">תמונת מצב יומית</p>
          <h1>דשבורד</h1>
          <p>כאן יוצגו המפגשים, המשימות, התשלומים והתראות הסנכרון.</p>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="מדדי דשבורד">
        <StatusCard
          title="מפגשים היום"
          value="0"
          description="יופיעו לאחר חיבור היומן הפנימי."
        />
        <StatusCard
          title="משימות פתוחות"
          value="0"
          description="משימות ותזכורות יתווספו בשלבי ה-CRUD."
        />
        <StatusCard
          title="תשלומים פתוחים"
          value="0"
          description="יוצג לאחר הוספת ניהול תשלומים."
        />
        <StatusCard
          className="sync-panel"
          title="התראות סנכרון"
          value="0"
          description="כשלים מול Google יישארו כאן עד טיפול."
        />

        <section className="status-card wide-panel">
          <h2>מפגשים קרובים</h2>
          <div className="empty-state">עדיין אין מפגשים להצגה.</div>
        </section>

        <section className="status-card wide-panel">
          <h2>פעולות להמשך</h2>
          <div className="empty-state">
            בשלב הבא יתווספו מטופלים, אירועים ותיעוד.
          </div>
        </section>
      </section>

      <PrimaryActionButton />
    </AppShell>
  );
}
