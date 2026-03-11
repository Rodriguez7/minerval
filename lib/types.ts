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
  name: string;
  school_name: string;
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
