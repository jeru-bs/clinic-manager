export const GOOGLE_DRIVE_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
  "16XWqhBGBZ053aRGPmuWTv0MOsM-d7JfV";

export const GOOGLE_DRIVE_ROOT_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_ROOT_FOLDER_ID}`;

export const googleWorkspaceFolders = [
  {
    key: "patients",
    name: "מטופלים",
    description: "תיקייה לכל מטופל"
  },
  {
    key: "templates",
    name: "תבניות",
    description: "תבניות מסמכים, סיכומים וקבלות"
  },
  {
    key: "system",
    name: "מערכת",
    description: "קובצי Google Sheets ולוגים פנימיים"
  }
] as const;

export const googleWorkspaceSpreadsheet = {
  name: "clinic-manager-data",
  parentFolderKey: "system",
  sheets: [
    {
      key: "patients",
      name: "patients",
      columns: [
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
      ]
    },
    {
      key: "sessions",
      name: "sessions",
      columns: [
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
      ]
    },
    {
      key: "payments",
      name: "payments",
      columns: [
        "id",
        "patient_id",
        "session_id",
        "amount",
        "payment_method",
        "payment_status",
        "receipt_status",
        "paid_at",
        "receipt_file_id",
        "notes",
        "created_at",
        "updated_at"
      ]
    },
    {
      key: "tasks",
      name: "tasks",
      columns: [
        "id",
        "patient_id",
        "title",
        "description",
        "status",
        "due_date",
        "source",
        "created_at",
        "updated_at"
      ]
    },
    {
      key: "files",
      name: "files",
      columns: [
        "id",
        "patient_id",
        "drive_file_id",
        "drive_folder_id",
        "name",
        "file_type",
        "url",
        "created_at",
        "updated_at"
      ]
    },
    {
      key: "sync_log",
      name: "sync_log",
      columns: [
        "id",
        "entity_type",
        "entity_id",
        "action",
        "status",
        "message",
        "google_resource_id",
        "created_at"
      ]
    }
  ]
} as const;

export function buildPatientFolderName(childName: string): string {
  return childName.trim();
}
