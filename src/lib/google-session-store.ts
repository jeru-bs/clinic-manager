import { randomUUID } from "crypto";
import { getGoogleAccessToken } from "@/lib/google-oauth";
import {
  getProvisioningStatus,
  googleFetch,
  type GoogleProvisioningStatus
} from "@/lib/google-provisioning";
import type { TreatmentSession, TreatmentSessionInput } from "@/lib/types";

const sessionColumns: Array<keyof TreatmentSession> = [
  "id",
  "patient_id",
  "session_date",
  "start_time",
  "end_time",
  "location",
  "session_type",
  "summary",
  "sensitive_notes",
  "calendar_event_id",
  "created_at",
  "updated_at"
];

type SessionColumn = keyof TreatmentSession;

function valueForColumn(session: TreatmentSession, column: SessionColumn): string {
  return String(session[column] || "");
}

function rowToSession(row: string[]): TreatmentSession {
  const record = Object.fromEntries(
    sessionColumns.map((column, index) => [column, row[index] || ""])
  ) as Record<SessionColumn, string>;

  return {
    id: record.id,
    patient_id: record.patient_id,
    session_date: record.session_date,
    start_time: record.start_time,
    end_time: record.end_time,
    location: record.location,
    session_type: record.session_type,
    summary: record.summary,
    sensitive_notes: record.sensitive_notes,
    calendar_event_id: record.calendar_event_id,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function sessionToRow(session: TreatmentSession): string[] {
  return sessionColumns.map((column) => valueForColumn(session, column));
}

async function getReadyWorkspace(): Promise<GoogleProvisioningStatus | null> {
  const [token, workspace] = await Promise.all([
    getGoogleAccessToken(),
    getProvisioningStatus()
  ]);

  if (!token || !workspace.provisioned || !workspace.spreadsheet?.id) {
    return null;
  }

  return workspace;
}

export async function canUseGoogleSessions(): Promise<boolean> {
  return Boolean(await getReadyWorkspace());
}

export async function listGoogleSessions(
  patientId?: string
): Promise<TreatmentSession[]> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/sessions!A2:L`;
  const result = await googleFetch<{ values?: string[][] }>(url);

  return (result.values || [])
    .filter((row) => row.some(Boolean))
    .map(rowToSession)
    .filter((session) => !patientId || session.patient_id === patientId)
    .sort((a, b) =>
      `${b.session_date} ${b.start_time}`.localeCompare(
        `${a.session_date} ${a.start_time}`
      )
    );
}

export async function createGoogleSession(
  input: TreatmentSessionInput
): Promise<TreatmentSession> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const now = new Date().toISOString();
  const session: TreatmentSession = {
    id: randomUUID(),
    patient_id: input.patient_id,
    session_date: input.session_date,
    start_time: input.start_time?.trim() || "",
    end_time: input.end_time?.trim() || "",
    location: input.location?.trim() || "",
    session_type: input.session_type?.trim() || "",
    summary: input.summary?.trim() || "",
    sensitive_notes: input.sensitive_notes?.trim() || "",
    calendar_event_id: "",
    created_at: now,
    updated_at: now
  };
  const appendUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/sessions!A:L:append`
  );

  appendUrl.searchParams.set("valueInputOption", "RAW");
  appendUrl.searchParams.set("insertDataOption", "INSERT_ROWS");

  await googleFetch(appendUrl.toString(), {
    method: "POST",
    body: JSON.stringify({
      values: [sessionToRow(session)]
    })
  });

  return session;
}
