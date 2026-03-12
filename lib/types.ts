export type PaymentStatus = "pending" | "success" | "failed";
export type Telecom = "AM" | "OM" | "MP" | "AF";

export const TELECOM_LABELS: Record<Telecom, string> = {
  AM: "Airtel Money",
  OM: "Orange Money",
  MP: "Vodacom-Mpesa",
  AF: "Afrimoney",
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
  serdipay_ref: string | null;
  serdipay_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  settled_at: string | null;
}

export interface School {
  id: string;
  name: string;
  code: string;
  admin_email: string;
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
