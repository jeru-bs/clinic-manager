export type PatientStatus = "active" | "paused" | "completed";

export type PaymentMethod = "cash" | "bank_transfer" | "check";

export type PaymentStatus = "unpaid" | "paid" | "partial" | "pending";

export type ReceiptStatus = "not_needed" | "needed" | "issued";

export type Patient = {
  id: string;
  child_name: string;
  address: string;
  school_name: string;
  treatment_type: string;
  fixed_price: string;
  fixed_day: string;
  fixed_time: string;
  treatment_goals: string;
  sensitive_notes: string;
  general_notes: string;
  status: PatientStatus;
  default_payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_status: ReceiptStatus;
  drive_folder_id: string;
  drive_folder_path: string;
  created_at: string;
  updated_at: string;
};

export type PatientInput = {
  child_name: string;
  address?: string;
  school_name?: string;
  treatment_type?: string;
  fixed_price?: string;
  fixed_day?: string;
  fixed_time?: string;
  treatment_goals?: string;
  sensitive_notes?: string;
  general_notes?: string;
  status?: PatientStatus;
  default_payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  receipt_status?: ReceiptStatus;
};

export type TreatmentSession = {
  id: string;
  patient_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  session_type: string;
  summary: string;
  sensitive_notes: string;
  calendar_event_id: string;
  created_at: string;
  updated_at: string;
};

export type TreatmentSessionInput = {
  patient_id: string;
  session_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  session_type?: string;
  summary?: string;
  sensitive_notes?: string;
};

export type Payment = {
  id: string;
  patient_id: string;
  session_id: string;
  amount: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_status: ReceiptStatus;
  paid_at: string;
  receipt_file_id: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type PaymentInput = {
  patient_id: string;
  session_id?: string;
  amount: string;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  receipt_status?: ReceiptStatus;
  paid_at?: string;
  receipt_file_id?: string;
  notes?: string;
};
