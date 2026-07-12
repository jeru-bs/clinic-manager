import { randomUUID } from "crypto";
import { getGoogleAccessToken } from "@/lib/google-oauth";
import {
  getProvisioningStatus,
  googleFetch,
  type GoogleProvisioningStatus
} from "@/lib/google-provisioning";
import type { Payment, PaymentInput } from "@/lib/types";

const paymentColumns: Array<keyof Payment> = [
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
];

type PaymentColumn = keyof Payment;

function valueForColumn(payment: Payment, column: PaymentColumn): string {
  return String(payment[column] || "");
}

function rowToPayment(row: string[]): Payment {
  const record = Object.fromEntries(
    paymentColumns.map((column, index) => [column, row[index] || ""])
  ) as Record<PaymentColumn, string>;

  return {
    id: record.id,
    patient_id: record.patient_id,
    session_id: record.session_id,
    amount: record.amount,
    payment_method: (record.payment_method || "bank_transfer") as Payment["payment_method"],
    payment_status: (record.payment_status || "unpaid") as Payment["payment_status"],
    receipt_status: (record.receipt_status || "needed") as Payment["receipt_status"],
    paid_at: record.paid_at,
    receipt_file_id: record.receipt_file_id,
    notes: record.notes,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function paymentToRow(payment: Payment): string[] {
  return paymentColumns.map((column) => valueForColumn(payment, column));
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

export async function canUseGooglePayments(): Promise<boolean> {
  return Boolean(await getReadyWorkspace());
}

export async function listGooglePayments(patientId?: string): Promise<Payment[]> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/payments!A2:L`;
  const result = await googleFetch<{ values?: string[][] }>(url);

  return (result.values || [])
    .filter((row) => row.some(Boolean))
    .map(rowToPayment)
    .filter((payment) => !patientId || payment.patient_id === patientId)
    .sort((a, b) =>
      `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
    );
}

export async function createGooglePayment(input: PaymentInput): Promise<Payment> {
  const workspace = await getReadyWorkspace();

  if (!workspace) {
    throw new Error("Google workspace is not connected");
  }

  const now = new Date().toISOString();
  const payment: Payment = {
    id: randomUUID(),
    patient_id: input.patient_id,
    session_id: input.session_id?.trim() || "",
    amount: input.amount.trim(),
    payment_method: input.payment_method || "bank_transfer",
    payment_status: input.payment_status || "paid",
    receipt_status: input.receipt_status || "needed",
    paid_at: input.paid_at?.trim() || new Date().toISOString().slice(0, 10),
    receipt_file_id: input.receipt_file_id?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now
  };
  const appendUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${workspace.spreadsheet?.id}/values/payments!A:L:append`
  );

  appendUrl.searchParams.set("valueInputOption", "RAW");
  appendUrl.searchParams.set("insertDataOption", "INSERT_ROWS");

  await googleFetch(appendUrl.toString(), {
    method: "POST",
    body: JSON.stringify({
      values: [paymentToRow(payment)]
    })
  });

  return payment;
}
