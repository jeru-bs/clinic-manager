"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Payment, PaymentMethod, PaymentStatus, ReceiptStatus } from "@/lib/types";

type PaymentForm = {
  amount: string;
  paid_at: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_status: ReceiptStatus;
  notes: string;
};

const emptyForm: PaymentForm = {
  amount: "",
  paid_at: new Date().toISOString().slice(0, 10),
  payment_method: "bank_transfer",
  payment_status: "paid",
  receipt_status: "needed",
  notes: ""
};

const methodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "העברה",
  cash: "מזומן",
  check: "צ'ק"
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "שולם",
  partial: "חלקי",
  pending: "ממתין",
  unpaid: "פתוח"
};

const receiptStatusLabels: Record<ReceiptStatus, string> = {
  issued: "הופקה",
  needed: "נדרשת",
  not_needed: "לא נדרש"
};

function formatDate(value: string): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00`));
}

function formatAmount(value: string): string {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return value || "-";
  }

  return new Intl.NumberFormat("he-IL", {
    currency: "ILS",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(amount);
}

export function PaymentManager({
  patientId,
  initialPayments
}: {
  patientId: string;
  initialPayments: Payment[];
}): React.ReactElement {
  const [payments, setPayments] = useState(initialPayments);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const latestPayments = useMemo(() => payments.slice(0, 5), [payments]);

  function updateField<Field extends keyof PaymentForm>(
    field: Field,
    value: PaymentForm[Field]
  ): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    const response = await fetch(`/api/patients/${patientId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    setIsSaving(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message || "לא ניתן היה לשמור תשלום.");
      return;
    }

    const body = (await response.json()) as { payment: Payment };
    setPayments((current) =>
      [body.payment, ...current].sort((a, b) =>
        `${b.paid_at} ${b.created_at}`.localeCompare(`${a.paid_at} ${a.created_at}`)
      )
    );
    setForm(emptyForm);
    setIsOpen(false);
    setMessage("התשלום נשמר.");
  }

  return (
    <div className="payment-manager">
      <div className="panel-heading">
        <div>
          <h2>תשלומים</h2>
          <span>מעקב גבייה וקבלות</span>
        </div>
        <button
          className="toolbar-button primary"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          תשלום חדש +
        </button>
      </div>

      {isOpen ? (
        <form className="payment-form" onSubmit={submitPayment}>
          <div className="form-grid payment-form-grid">
            <div className="field">
              <label htmlFor="payment_amount">סכום</label>
              <input
                id="payment_amount"
                inputMode="decimal"
                name="amount"
                onChange={(event) => updateField("amount", event.target.value)}
                required
                value={form.amount}
              />
            </div>
            <div className="field">
              <label htmlFor="paid_at">תאריך</label>
              <input
                id="paid_at"
                name="paid_at"
                onChange={(event) => updateField("paid_at", event.target.value)}
                type="date"
                value={form.paid_at}
              />
            </div>
            <div className="field">
              <label htmlFor="payment_method">אמצעי</label>
              <select
                id="payment_method"
                name="payment_method"
                onChange={(event) =>
                  updateField("payment_method", event.target.value as PaymentMethod)
                }
                value={form.payment_method}
              >
                <option value="bank_transfer">העברה</option>
                <option value="cash">מזומן</option>
                <option value="check">צ'ק</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="payment_status">סטטוס</label>
              <select
                id="payment_status"
                name="payment_status"
                onChange={(event) =>
                  updateField("payment_status", event.target.value as PaymentStatus)
                }
                value={form.payment_status}
              >
                <option value="paid">שולם</option>
                <option value="partial">חלקי</option>
                <option value="pending">ממתין</option>
                <option value="unpaid">פתוח</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="receipt_status">קבלה</label>
              <select
                id="receipt_status"
                name="receipt_status"
                onChange={(event) =>
                  updateField("receipt_status", event.target.value as ReceiptStatus)
                }
                value={form.receipt_status}
              >
                <option value="needed">נדרשת</option>
                <option value="issued">הופקה</option>
                <option value="not_needed">לא נדרש</option>
              </select>
            </div>
            <div className="field wide">
              <label htmlFor="payment_notes">הערות</label>
              <textarea
                id="payment_notes"
                name="notes"
                onChange={(event) => updateField("notes", event.target.value)}
                rows={2}
                value={form.notes}
              />
            </div>
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="toolbar">
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "שומר..." : "שמירה"}
            </button>
            <button
              className="secondary-button"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ביטול
            </button>
          </div>
        </form>
      ) : null}

      {message ? <div className="form-success payment-message">{message}</div> : null}

      {latestPayments.length === 0 ? (
        <div className="empty-state compact">עדיין אין תשלומים בכרטיס.</div>
      ) : (
        <div className="payment-list">
          {latestPayments.map((payment) => (
            <article className="payment-item" key={payment.id}>
              <div>
                <strong>{formatAmount(payment.amount)}</strong>
                <span>{formatDate(payment.paid_at)}</span>
              </div>
              <div>
                <strong>{methodLabels[payment.payment_method]}</strong>
                <span>{paymentStatusLabels[payment.payment_status]}</span>
              </div>
              <div>
                <span className="payment-status">
                  {receiptStatusLabels[payment.receipt_status]}
                </span>
              </div>
              <p>{payment.notes || "ללא הערות."}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
