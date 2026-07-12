import { AppShell } from "@/components/AppShell";
import { PatientManager } from "@/components/PatientManager";
import { listPatients } from "@/lib/patient-store";

export default async function PatientsPage(): Promise<React.ReactElement> {
  const patients = await listPatients();

  return (
    <AppShell>
      <div className="page">
        <section className="workbench-header">
          <div className="page-title-inline">
            <p className="eyebrow">מטופלים</p>
            <h1>רשימת מטופלים</h1>
            <p>
              ניהול פרטים בסיסיים, מועדים קבועים וסטטוס לפני חיבור Google
              Sheets.
            </p>
          </div>
        </section>

        <PatientManager initialPatients={patients} />
      </div>
    </AppShell>
  );
}
