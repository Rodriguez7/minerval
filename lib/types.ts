export type PaymentStatus = "pending" | "success" | "failed";
export type ReconciliationStatus =
  | "pending_review"
  | "reconciled"
  | "needs_review"
  | "manual_override";
export type Telecom = "AM" | "OM" | "MP" | "AF";

export const TELECOM_LABELS: Record<Telecom, string> = {
  AM: "Airtel Money",
  OM: "Orange Money",
  MP: "Vodacom-Mpesa",
  AF: "Afrimoney",
};

export const RECONCILIATION_LABELS: Record<ReconciliationStatus, string> = {
  pending_review: "Pending review",
  reconciled: "Reconciled",
  needs_review: "Needs review",
  manual_override: "Manual override",
};

export interface StudentInfo {
  student_id: string;
  full_name: string;
  school_name: string;
  school_code: string;
  amount_due: number;
}

export interface PaymentRequest {
  id: string;
  student_id: string;
  school_id: string;
  amount: number;
  phone: string;
  telecom: Telecom;
  status: PaymentStatus;
  reconciliation_status: ReconciliationStatus;
  reconciliation_note: string | null;
  reconciliation_updated_at: string | null;
  reconciliation_updated_by: string | null;
  serdipay_ref: string | null;
  serdipay_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
}

export type Currency = "FC" | "USD";

export interface School {
  id: string;
  name: string;
  code: string;
  admin_email: string;
  payment_access_token: string;
  student_id_prefix: string;
  student_id_seq: number;
  currency: Currency;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  external_id: string;
  full_name: string;
  class_name: string | null;
  amount_due: number;
  created_at: string;
}

export interface Fee {
  id: string;
  school_id: string;
  title: string;
  type: "recurring" | "special";
  amount: number;
  active: boolean;
  created_at: string;
}

export interface PaymentEvent {
  id: string;
  payment_request_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}
