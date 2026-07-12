import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  canUseGoogleSessions,
  createGoogleSession,
  listGoogleSessions
} from "@/lib/google-session-store";
import type { TreatmentSession, TreatmentSessionInput } from "@/lib/types";

const dataFilePath = join(process.cwd(), "work", "local-data", "sessions.json");

async function ensureDataFile(): Promise<void> {
  await mkdir(dirname(dataFilePath), { recursive: true });

  try {
    await readFile(dataFilePath, "utf8");
  } catch {
    await writeFile(dataFilePath, "[]", "utf8");
  }
}

async function readSessionsFile(): Promise<TreatmentSession[]> {
  await ensureDataFile();
  const content = await readFile(dataFilePath, "utf8");

  try {
    const sessions = JSON.parse(content) as TreatmentSession[];
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

async function writeSessionsFile(sessions: TreatmentSession[]): Promise<void> {
  await ensureDataFile();
  await writeFile(dataFilePath, `${JSON.stringify(sessions, null, 2)}\n`, "utf8");
}

function sortSessions(sessions: TreatmentSession[]): TreatmentSession[] {
  return sessions.sort((a, b) =>
    `${b.session_date} ${b.start_time}`.localeCompare(
      `${a.session_date} ${a.start_time}`
    )
  );
}

export async function listSessions(
  patientId?: string
): Promise<TreatmentSession[]> {
  if (await canUseGoogleSessions()) {
    return listGoogleSessions(patientId);
  }

  const sessions = await readSessionsFile();
  return sortSessions(
    patientId
      ? sessions.filter((session) => session.patient_id === patientId)
      : sessions
  );
}

export async function createSessionRecord(
  input: TreatmentSessionInput
): Promise<TreatmentSession> {
  if (await canUseGoogleSessions()) {
    return createGoogleSession(input);
  }

  const now = new Date().toISOString();
  const sessions = await readSessionsFile();
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

  sessions.push(session);
  await writeSessionsFile(sessions);
  return session;
}

export function validateSessionInput(
  patientId: string,
  input: unknown
): TreatmentSessionInput {
  const body = input as Partial<TreatmentSessionInput>;
  const sessionDate =
    typeof body.session_date === "string" ? body.session_date.trim() : "";

  if (!sessionDate) {
    throw new Error("תאריך מפגש הוא שדה חובה.");
  }

  return {
    patient_id: patientId,
    session_date: sessionDate,
    start_time: typeof body.start_time === "string" ? body.start_time : "",
    end_time: typeof body.end_time === "string" ? body.end_time : "",
    location: typeof body.location === "string" ? body.location : "",
    session_type: typeof body.session_type === "string" ? body.session_type : "",
    summary: typeof body.summary === "string" ? body.summary : "",
    sensitive_notes:
      typeof body.sensitive_notes === "string" ? body.sensitive_notes : ""
  };
}
