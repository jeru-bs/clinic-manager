import { AppShell } from "@/components/AppShell";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

const kpis = [
  { title: "מפגשים היום", value: "0", symbol: "מ", className: "kpi-blue" },
  { title: "משימות פתוחות", value: "0", symbol: "ש", className: "kpi-teal" },
  { title: "תשלומים פתוחים", value: "0", symbol: "ת", className: "kpi-pink" },
  { title: "כשלים בסנכרון", value: "0", symbol: "ס", className: "kpi-purple" }
];

export default function DashboardPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">תמונת מצב יומית</p>
            <h1>דשבורד</h1>
            <p>
              סקירה מהירה של היום, משימות פתוחות ותקלות שמחכות לטיפול.
            </p>
          </div>

          <div className="header-actions">
            <button className="toolbar-button yellow" type="button">
              סינון תאריך
            </button>
            <button className="toolbar-button secondary" type="button">
              רענון
            </button>
            <button className="toolbar-button primary" type="button">
              פעולה חדשה +
            </button>
          </div>
        </section>

        <section className="kpi-grid" aria-label="מדדי דשבורד">
          {kpis.map((kpi) => (
            <article className={`kpi-card ${kpi.className}`} key={kpi.title}>
              <div>
                <strong>{kpi.value}</strong>
                <span>{kpi.title}</span>
              </div>
              <div className="kpi-symbol" aria-hidden="true">
                {kpi.symbol}
              </div>
            </article>
          ))}
        </section>

        <section className="dashboard-tables">
          <div className="data-panel">
            <div className="panel-heading">
              <h2>מפגשים קרובים</h2>
              <span>היום והשבוע הקרוב</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שעה</th>
                    <th>מטופל</th>
                    <th>סוג מפגש</th>
                    <th>מיקום</th>
                    <th>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">עדיין אין מפגשים להצגה.</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-panel">
            <div className="panel-heading">
              <h2>דורש טיפול</h2>
              <span>משימות, תשלומים וסנכרון</span>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>סוג</th>
                    <th>פריט</th>
                    <th>עדיפות</th>
                    <th>פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        אין התראות פתוחות כרגע.
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <PrimaryActionButton />
      </div>
    </AppShell>
  );
}
