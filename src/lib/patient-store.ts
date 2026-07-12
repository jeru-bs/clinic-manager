import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  canUseGooglePatients,
  createGooglePatient,
  deleteGooglePatient,
  listGooglePatients,
  updateGooglePatient
} from "@/lib/google-patient-store";
import type { Patient, PatientInput } from "@/lib/types";

const dataFilePath = join(process.cwd(), "work", "local-data", "patients.json");

async function ensureDataFile(): Promise<void> {
  await mkdir(dirname(dataFilePath), { recursive: true });

  try {
    await readFile(dataFilePath, "utf8");
  } catch {
    await writeFile(dataFilePath, "[]", "utf8");
  }
}

async function readPatientsFile(): Promise<Patient[]> {
  await ensureDataFile();
  const content = await readFile(dataFilePath, "utf8");

  try {
    const patients = JSON.parse(content) as Patient[];
    return Array.isArray(patients) ? patients : [];
  } catch {
    return [];
  }
}

async function writePatientsFile(patients: Patient[]): Promise<void> {
  await ensureDataFile();
  await writeFile(dataFilePath, `${JSON.stringify(patients, null, 2)}\n`, "utf8");
}

export async function listPatients(): Promise<Patient[]> {
  if (await canUseGooglePatients()) {
    return listGooglePatients();
  }

  const patients = await readPatientsFile();
  return patients.sort((a, b) => a.child_name.localeCompare(b.child_name, "he"));
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  const patients = await listPatients();
  return patients.find((patient) => patient.id === id);
}

export async function createPatient(input: PatientInput): Promise<Patient> {
  if (await canUseGooglePatients()) {
    return createGooglePatient(input);
  }

  const now = new Date().toISOString();
  const patients = await readPatientsFile();
  const patient: Patient = {
    id: randomUUID(),
    child_name: input.child_name.trim(),
    address: input.address?.trim() || "",
    school_name: input.school_name?.trim() || "",
    treatment_type: input.treatment_type?.trim() || "",
    fixed_price: input.fixed_price?.trim() || "",
    fixed_day: input.fixed_day?.trim() || "",
    fixed_time: input.fixed_time?.trim() || "",
    treatment_goals: input.treatment_goals?.trim() || "",
    sensitive_notes: input.sensitive_notes?.trim() || "",
    general_notes: input.general_notes?.trim() || "",
    status: input.status || "active",
    default_payment_method: input.default_payment_method || "bank_transfer",
    payment_status: input.payment_status || "unpaid",
    receipt_status: input.receipt_status || "needed",
    drive_folder_id: "",
    drive_folder_path: "",
    created_at: now,
    updated_at: now
  };

  patients.push(patient);
  await writePatientsFile(patients);
  return patient;
}

export async function updatePatient(
  id: string,
  input: PatientInput
): Promise<Patient | undefined> {
  if (await canUseGooglePatients()) {
    return (await updateGooglePatient(id, input)) || undefined;
  }

  const patients = await readPatientsFile();
  const index = patients.findIndex((patient) => patient.id === id);

  if (index === -1) {
    return undefined;
  }

  const current = patients[index];
  const updated: Patient = {
    ...current,
    child_name: input.child_name.trim(),
    address: input.address?.trim() || "",
    school_name: input.school_name?.trim() || "",
    treatment_type: input.treatment_type?.trim() || "",
    fixed_price: input.fixed_price?.trim() || "",
    fixed_day: input.fixed_day?.trim() || "",
    fixed_time: input.fixed_time?.trim() || "",
    treatment_goals: input.treatment_goals?.trim() || "",
    sensitive_notes: input.sensitive_notes?.trim() || "",
    general_notes: input.general_notes?.trim() || "",
    status: input.status || current.status,
    default_payment_method: input.default_payment_method || current.default_payment_method,
    payment_status: input.payment_status || current.payment_status,
    receipt_status: input.receipt_status || current.receipt_status,
    updated_at: new Date().toISOString()
  };

  patients[index] = updated;
  await writePatientsFile(patients);
  return updated;
}

export async function deletePatient(id: string): Promise<boolean> {
  if (await canUseGooglePatients()) {
    return deleteGooglePatient(id);
  }

  const patients = await readPatientsFile();
  const nextPatients = patients.filter((patient) => patient.id !== id);

  if (nextPatients.length === patients.length) {
    return false;
  }

  await writePatientsFile(nextPatients);
  return true;
}

export function validatePatientInput(input: unknown): PatientInput {
  const body = input as Partial<PatientInput>;
  const childName = typeof body.child_name === "string" ? body.child_name.trim() : "";

  if (!childName) {
    throw new Error("שם הילד הוא שדה חובה.");
  }

  return {
    child_name: childName,
    address: typeof body.address === "string" ? body.address : "",
    school_name: typeof body.school_name === "string" ? body.school_name : "",
    treatment_type: typeof body.treatment_type === "string" ? body.treatment_type : "",
    fixed_price: typeof body.fixed_price === "string" ? body.fixed_price : "",
    fixed_day: typeof body.fixed_day === "string" ? body.fixed_day : "",
    fixed_time: typeof body.fixed_time === "string" ? body.fixed_time : "",
    treatment_goals: typeof body.treatment_goals === "string" ? body.treatment_goals : "",
    sensitive_notes: typeof body.sensitive_notes === "string" ? body.sensitive_notes : "",
    general_notes: typeof body.general_notes === "string" ? body.general_notes : ""
  };
}
