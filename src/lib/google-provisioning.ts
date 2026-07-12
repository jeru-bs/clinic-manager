import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { getGoogleAccessToken } from "@/lib/google-oauth";
import {
  GOOGLE_DRIVE_ROOT_FOLDER_ID,
  googleWorkspaceFolders,
  googleWorkspaceSpreadsheet
} from "@/lib/google-workspace";

const metadataFilePath = join(
  process.cwd(),
  "work",
  "local-data",
  "google-workspace.json"
);

export type DriveFile = {
  id: string;
  name: string;
  parents?: string[];
  webViewLink?: string;
};

export type GoogleProvisioningStatus = {
  provisioned: boolean;
  folders?: Record<string, DriveFile>;
  spreadsheet?: DriveFile;
  updatedAt?: string;
};

export async function googleFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getGoogleAccessToken();

  if (!token) {
    throw new Error("Google is not connected");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Google API failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function columnLetter(index: number): string {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

async function findDriveFile(
  parentId: string,
  name: string,
  mimeType: string
): Promise<DriveFile | null> {
  const query = [
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    `name='${escapeDriveQueryValue(name)}'`,
    `mimeType='${escapeDriveQueryValue(mimeType)}'`,
    "trashed=false"
  ].join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");

  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,name,parents,webViewLink)");
  url.searchParams.set("spaces", "drive");

  const result = await googleFetch<{ files: DriveFile[] }>(url.toString());
  return result.files[0] || null;
}

async function ensureFolder(parentId: string, name: string): Promise<DriveFile> {
  const existing = await findDriveFile(
    parentId,
    name,
    "application/vnd.google-apps.folder"
  );

  if (existing) return existing;

  return googleFetch<DriveFile>("https://www.googleapis.com/drive/v3/files?fields=id,name,parents,webViewLink", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    })
  });
}

async function ensureSpreadsheet(systemFolderId: string): Promise<DriveFile> {
  const existing = await findDriveFile(
    systemFolderId,
    googleWorkspaceSpreadsheet.name,
    "application/vnd.google-apps.spreadsheet"
  );

  if (existing) return existing;

  const spreadsheet = await googleFetch<{ spreadsheetId: string }>(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title: googleWorkspaceSpreadsheet.name },
        sheets: googleWorkspaceSpreadsheet.sheets.map((sheet) => ({
          properties: { title: sheet.name }
        }))
      })
    }
  );

  const file = await googleFetch<DriveFile>(
    `https://www.googleapis.com/drive/v3/files/${spreadsheet.spreadsheetId}?fields=id,name,parents,webViewLink`
  );
  const removeParents = file.parents?.join(",");
  const moveUrl = new URL(
    `https://www.googleapis.com/drive/v3/files/${spreadsheet.spreadsheetId}`
  );

  moveUrl.searchParams.set("addParents", systemFolderId);
  if (removeParents) moveUrl.searchParams.set("removeParents", removeParents);
  moveUrl.searchParams.set("fields", "id,name,parents,webViewLink");

  return googleFetch<DriveFile>(moveUrl.toString(), { method: "PATCH" });
}

async function writeSheetHeaders(spreadsheetId: string): Promise<void> {
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: googleWorkspaceSpreadsheet.sheets.map((sheet) => ({
          range: `${sheet.name}!A1:${columnLetter(sheet.columns.length - 1)}1`,
          values: [sheet.columns]
        }))
      })
    }
  );
}

export async function getProvisioningStatus(): Promise<GoogleProvisioningStatus> {
  try {
    return JSON.parse(await readFile(metadataFilePath, "utf8")) as GoogleProvisioningStatus;
  } catch {
    return { provisioned: false };
  }
}

export async function provisionGoogleWorkspace(): Promise<GoogleProvisioningStatus> {
  const folders: Record<string, DriveFile> = {};

  for (const folder of googleWorkspaceFolders) {
    folders[folder.key] = await ensureFolder(GOOGLE_DRIVE_ROOT_FOLDER_ID, folder.name);
  }

  const systemFolder = folders[googleWorkspaceSpreadsheet.parentFolderKey];
  const spreadsheet = await ensureSpreadsheet(systemFolder.id);

  await writeSheetHeaders(spreadsheet.id);

  const status: GoogleProvisioningStatus = {
    provisioned: true,
    folders,
    spreadsheet,
    updatedAt: new Date().toISOString()
  };

  await mkdir(dirname(metadataFilePath), { recursive: true });
  await writeFile(metadataFilePath, `${JSON.stringify(status, null, 2)}\n`, "utf8");

  return status;
}
