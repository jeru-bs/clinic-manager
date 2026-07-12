import Link from "next/link";
import { PaymentManager } from "@/components/PaymentManager";
import { SessionManager } from "@/components/SessionManager";
import type { Patient, Payment, TreatmentSession } from "@/lib/types";

const statusLabels: Record<Patient["status"], string> = {
  active: "פעיל",
  paused: "בהפסקה",
  completed: "הסתיים"
};

const paymentStatusLabels: Record<Patient["payment_status"], string> = {
  paid: "שולם",
  partial: "חלקי",
  pending: "ממתין",
  unpaid: "פתוח"
};

const receiptStatusLabels: Record<Patient["receipt_status"], string> = {
  issued: "הופקה",
  needed: "נדרש",
  not_needed: "לא נדרש"
};

function valueOrDash(value: string): string {
  return value.trim() || "-";
}

function DetailItem({
  label,
  value
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{valueOrDash(value)}</strong>
    </div>
  );
}

export function PatientProfile({
  patient,
  payments,
  sessions
}: {
  patient: Patient;
  payments: Payment[];
  sessions: TreatmentSession[];
}): React.ReactElement {
  const fixedSchedule = [patient.fixed_day, patient.fixed_time]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="patient-profile">
      <section className="profile-hero">
        <div>
          <p className="eyebrow">כרטיס מטופל</p>
          <h1>{patient.child_name}</h1>
          <p>
            {valueOrDash(patient.treatment_type)} |{" "}
            {fixedSchedule || "לא הוגדר מועד קבוע"}
          </p>
        </div>

        <div className="profile-actions">
          <Link className="toolbar-button secondary" href="/patients">
            חזרה לרשימה
          </Link>
          <button className="toolbar-button primary" type="button">
            עריכת פרטים
          </button>
        </div>
      </section>

      <section className="profile-metrics" aria-label="מדדי מטופל">
        <article className="mini-metric">
          <span>סטטוס טיפול</span>
          <strong>{statusLabels[patient.status]}</strong>
        </article>
        <article className="mini-metric">
          <span>תשלום</span>
          <strong>{paymentStatusLabels[patient.payment_status]}</strong>
        </article>
        <article className="mini-metric">
          <span>קבלה</span>
          <strong>{receiptStatusLabels[patient.receipt_status]}</strong>
        </article>
        <article className="mini-metric">
          <span>מחיר קבוע</span>
          <strong>{valueOrDash(patient.fixed_price)}</strong>
        </article>
      </section>

      <section className="profile-grid">
        <div className="data-panel profile-section">
          <div className="panel-heading">
            <h2>פרטים כלליים</h2>
            <span>מידע בסיסי לעבודה שוטפת</span>
          </div>
          <div className="detail-grid">
            <DetailItem label="שם" value={patient.child_name} />
            <DetailItem label="מוסד לימודים" value={patient.school_name} />
            <DetailItem label="כתובת" value={patient.address} />
            <DetailItem label="סוג טיפול" value={patient.treatment_type} />
            <DetailItem label="יום קבוע" value={patient.fixed_day} />
            <DetailItem label="שעה קבועה" value={patient.fixed_time} />
          </div>
        </div>

        <div className="data-panel profile-section">
          <div className="panel-heading">
            <h2>תיעוד והערות</h2>
            <span>רגיש נשאר בתוך המערכת בלבד</span>
          </div>
          <div className="notes-grid">
            <article>
              <h3>מטרות טיפול</h3>
              <p>{valueOrDash(patient.treatment_goals)}</p>
            </article>
            <article>
              <h3>הערות כלליות</h3>
              <p>{valueOrDash(patient.general_notes)}</p>
            </article>
            <article className="sensitive-note">
              <h3>הערות רגישות</h3>
              <p>{valueOrDash(patient.sensitive_notes)}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="profile-grid three">
        <div className="data-panel profile-section">
          <SessionManager patientId={patient.id} initialSessions={sessions} />
        </div>

        <div className="data-panel profile-section">
          <PaymentManager patientId={patient.id} initialPayments={payments} />
        </div>

        <div className="data-panel profile-section">
          <div className="panel-heading">
            <h2>קבצים</h2>
            <span>Google Drive בהמשך</span>
          </div>
          <div className="empty-state compact">תיקיית Drive תתחבר בשלב הבא.</div>
        </div>
      </section>
    </div>
  );
}
