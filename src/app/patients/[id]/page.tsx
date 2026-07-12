import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PatientProfile } from "@/components/PatientProfile";
import { getPatientById } from "@/lib/patient-store";
import { listPayments } from "@/lib/payment-store";
import { listSessions } from "@/lib/session-store";

export default async function PatientPage({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const [patient, sessions, payments] = await Promise.all([
    getPatientById(id),
    listSessions(id),
    listPayments(id)
  ]);

  if (!patient) {
    notFound();
  }

  return (
    <AppShell>
      <div className="page">
        <PatientProfile patient={patient} payments={payments} sessions={sessions} />
      </div>
    </AppShell>
  );
}
