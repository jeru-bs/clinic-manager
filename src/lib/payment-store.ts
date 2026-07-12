import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import {
  canUseGooglePayments,
  createGooglePayment,
  listGooglePayments
} from "@/lib/google-payment-store";
import type { Payment, PaymentInput } from "@/lib/types";

const dataFilePath = join(process.cwd(), "work", "local-data", "payments.json");

async function ensureDataFile(): Promise<void> {
  await mkdir(dirname(dataFilePath), { recursive: true });

  try {
    await readFile(dataFilePath, "utf8");
  } catch {
    await writeFile(dataFilePath, "[]", "utf8");
  }
}

async function readPaymentsFile(): Promise<Payment[]> {
  await ensureDataFile();
  const content = await readFile(dataFilePath, "utf8");

  try {
    const payments = JSON.parse(content) as Payment[];
    return Array.isArray(payments) ? payments : [];
  } catch {
    return [];
  }
}

async function writePaymentsFile(payments: Payment[]): Promise<void> {
  await ensureDataFile();
  await writeFile(dataFilePath, `${JSON.stringify(payments, null, 2)}\n`, "utf8");
}

function sortPayments(payments: Payment[]): Payment[] {
  return payments.sort((a, b) =>
    `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
  );
}

export async function listPayments(patientId?: string): Promise<Payment[]> {
  if (await canUseGooglePayments()) {
    return listGooglePayments(patientId);
  }

  const payments = await readPaymentsFile();
  return sortPayments(
    patientId
      ? payments.filter((payment) => payment.patient_id === patientId)
      : payments
  );
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  if (await canUseGooglePayments()) {
    return createGooglePayment(input);
  }

  const now = new Date().toISOString();
  const payments = await readPaymentsFile();
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

  payments.push(payment);
  await writePaymentsFile(payments);
  return payment;
}

export function validatePaymentInput(
  patientId: string,
  input: unknown
): PaymentInput {
  const body = input as Partial<PaymentInput>;
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";

  if (!amount) {
    throw new Error("סכום התשלום הוא שדה חובה.");
  }

  return {
    patient_id: patientId,
    session_id: typeof body.session_id === "string" ? body.session_id : "",
    amount,
    payment_method: body.payment_method || "bank_transfer",
    payment_status: body.payment_status || "paid",
    receipt_status: body.receipt_status || "needed",
    paid_at: typeof body.paid_at === "string" ? body.paid_at : "",
    receipt_file_id:
      typeof body.receipt_file_id === "string" ? body.receipt_file_id : "",
    notes: typeof body.notes === "string" ? body.notes : ""
  };
}
