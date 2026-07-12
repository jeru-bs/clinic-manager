import { randomUUID } from "crypto";
import { getGoogleAccessToken } from "@/lib/google-oauth";
import {
  getProvisioningStatus,
  googleFetch,
  type GoogleProvisioningStatus
} from "@/lib/google-provisioning";
import { buildPatientFolderName } from "@/lib/google-workspace";
import type { Patient, PatientInput } from "@/lib/types";

const patientColumns: Array<keyof Patient> = [
  "id",
  "child_name",
  "address",
  "school_name",
  "treatment_type",
  "fixed_price",
  "fixed_day",
  "fixed_time",
  "treatment_goals",
  "sensitive_notes",
  "general_notes",
  "status",
  "default_payment_method",
  "payment_status",
  "receipt_status",
  "drive_folder_id",
  "drive_folder_path",
  "created_at",
  "updated_at"
];

type PatientColumn = keyof Patient;

function valueForColumn(patient: Patient, column: PatientColumn): string {
  return String(patient[column] || "");
}

function rowToPatient(row: string[]): Patient {
  const record = Object.fromEntries(
    patientColumns.map((column, index) => [column, row[index] || ""])
  ) as Record<PatientColumn, string>;

  return {
    id: record.id,
    child_name: record.child_name,
    address: record.address,
    school_name: record.school_name,
    treatment_type: record.treatment_type,
    fixed_price: record.fixed_price,
    fixed_day: record.fixed_day,
    fixed_time: record.fixed_time,
    treatment_goals: record.treatment_goals,
    sensitive_notes: record.sensitive_notes,
    general_notes: record.general_notes,
    status: (record.status || "active") as Patient["status"],
    default_payment_method: (record.default_payment_method ||
      "bank_transfer") as Patient["default_payment_method"],
    payment_status: (record.payment_status || "unpaid") as Patient["payment_status"],
    receipt_status: (record.receipt_status || "needed") as Patient["receipt_status"],
    drive_folder_id: record.drive_folder_id,
    drive_folder_path: record.drive_folder_path,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function patientToRow(patient: Patient): string[] {
  return patientColumns.map((column) => valueForColumn(patient, column));
}

async function getReadyWorkspace(): Promise<GoogleProvisioningStatus | null> {
  const [token, workspace] = await Promise.all([
    getGoogleAccessToken(),
    getProvisioningStatus()
  ]);

  if (!token || !workspace.provisioned || !workspace.spreadsheet?.id) {
    return null;
  }

  if (!workspace.folders?.patients?.id) {
    return null;
  }

  return workspace;
}

async function createPatientFolder(
  workspace: GoogleProvisioningStatus,
  patient: Patient
): Promise<{ id: string; path: string }> {
  const folderName = buildPatientFolderName(patient.child_name);
  const folder = await googleFetch<{ id: string; name: string }>(
    "https://www.googleapis.com/drive/v3/files?fields=id,name",
    {
      method: "POST",
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [workspace.folders?.patients?.id]
      })
    }
  );

  return {
    id: folder.id,
    path: `מטופלים/${folder.name}`
  };
}

export async function canUseGooglePatients(): Promise<boolean> {
  return Boolean(await getReadyWorkspace());
}

export async function listGooglePatients(): Promise<Patient[]> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/patients!A2:S`;
  const result = await googleFetch<{ values?: string[][] }>(url);

  return (result.values || [])
    .filter((row) => row.some(Boolean))
    .map(rowToPatient)
    .sort((a, b) => a.child_name.localeCompare(b.child_name, "he"));
}

async function getGooglePatientRow(
  id: string
): Promise<{ patient: Patient; rowNumber: number } | null> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/patients!A2:S`;
  const result = await googleFetch<{ values?: string[][] }>(url);
  const rowIndex = (result.values || []).findIndex((row) => row[0] === id);

  if (rowIndex === -1 || !result.values?.[rowIndex]) {
    return null;
  }

  return {
    patient: rowToPatient(result.values[rowIndex]),
    rowNumber: rowIndex + 2
  };
}

async function getPatientsSheetId(spreadsheetId: string): Promise<number> {
  const metadata = await googleFetch<{
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`
  );
  const sheet = metadata.sheets.find(
    (candidate) => candidate.properties.title === "patients"
  );

  if (!sheet) {
    throw new Error("Patients sheet is missing");
  }

  return sheet.properties.sheetId;
}

export async function createGooglePatient(input: PatientInput): Promise<Patient> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const now = new Date().toISOString();
  const basePatient: Patient = {
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
  const folder = await createPatientFolder(workspace, basePatient);
  const patient: Patient = {
    ...basePatient,
    drive_folder_id: folder.id,
    drive_folder_path: folder.path
  };
  const appendUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/patients!A:S:append`
  );

  appendUrl.searchParams.set("valueInputOption", "RAW");
  appendUrl.searchParams.set("insertDataOption", "INSERT_ROWS");

  await googleFetch(appendUrl.toString(), {
    method: "POST",
    body: JSON.stringify({
      values: [patientToRow(patient)]
    })
  });

  return patient;
}

export async function updateGooglePatient(
  id: string,
  input: PatientInput
): Promise<Patient | null> {
  const workspace = await getReadyWorkspace();
  const existing = await getGooglePatientRow(id);

  if (!workspace || !existing) {
    return null;
  }

  const patient: Patient = {
    ...existing.patient,
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
    status: input.status || existing.patient.status,
    default_payment_method:
      input.default_payment_method || existing.patient.default_payment_method,
    payment_status: input.payment_status || existing.patient.payment_status,
    receipt_status: input.receipt_status || existing.patient.receipt_status,
    updated_at: new Date().toISOString()
  };
  const updateUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/patients!A${existing.rowNumber}:S${existing.rowNumber}`
  );

  updateUrl.searchParams.set("valueInputOption", "RAW");

  await googleFetch(updateUrl.toString(), {
    method: "PUT",
    body: JSON.stringify({
      values: [patientToRow(patient)]
    })
  });

  return patient;
}

export async function deleteGooglePatient(id: string): Promise<boolean> {
  const workspace = await getReadyWorkspace();
  const existing = await getGooglePatientRow(id);
  const spreadsheetId = workspace?.spreadsheet?.id;

  if (!workspace || !spreadsheetId || !existing) {
    return false;
  }

  const sheetId = await getPatientsSheetId(spreadsheetId);

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: existing.rowNumber - 1,
                endIndex: existing.rowNumber
              }
            }
          }
        ]
      })
    }
  );

  return true;
}
