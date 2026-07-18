import type { EducationLevel } from "./congo-education";

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
  pending_review: "En attente de verification",
  reconciled: "Rapproche",
  needs_review: "A verifier",
  manual_override: "Resolution manuelle",
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
  receipt_access_token: string;
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

export type SchoolVerificationStatus = "unverified" | "pending" | "verified" | "rejected";

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
  education_levels: EducationLevel[];
  // Added by migration 006
  billing_email: string | null;
  billing_contact: string | null;
  timezone: string;
  support_tier: string;
  // Added by migration 010
  logo_url: string | null;
  // Added by migration 015
  verification_status: SchoolVerificationStatus;
  legal_name: string | null;
  registration_number: string | null;
  school_address: string | null;
  director_name: string | null;
  director_phone: string | null;
  payout_account_name: string | null;
  payout_account_phone: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  verification_rejection_reason: string | null;
  // Added by migration 021
  status: "active" | "closed";
  closed_at: string | null;
  closed_by: string | null;
  closure_reason: string | null;
}

export interface Student {
  id: string;
  school_id: string;
  external_id: string;
  full_name: string;
  class_name: string | null;
  amount_due: number;
  balance_due_at: string | null;
  reminder_cycle_id: string | null;
  reminders_paused_until: string | null;
  reminder_stop_reason: string | null;
  created_at: string;
}

export type GuardianRelationship = "parent" | "guardian" | "payer";
export type WhatsAppLocale = "fr";
export type WhatsAppMessageKind =
  | "payment_reminder"
  | "payment_confirmed"
  | "payment_failed";
export type WhatsAppMessageStatus =
  | "queued"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled";

export interface Guardian {
  id: string;
  school_id: string;
  full_name: string;
  whatsapp_phone: string;
  preferred_locale: WhatsAppLocale;
  whatsapp_opt_in_at: string;
  whatsapp_opt_in_source: "manual_entry" | "csv_import" | "parent_form";
  whatsapp_opted_out_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  school_id: string;
  student_id: string;
  guardian_id: string;
  reminder_cycle_id: string;
  kind: WhatsAppMessageKind;
  stage: number | null;
  template_name: string;
  locale: WhatsAppLocale;
  scheduled_for: string;
  amount_snapshot: number;
  currency: string;
  status: WhatsAppMessageStatus;
  meta_message_id: string | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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

// ── SaaS / multi-tenant types ──────────────────────────────────────────────

export type MembershipRole = "owner" | "admin" | "finance" | "viewer";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Plan {
  code: string;
  name: string;
  monthly_price_usd: number;
  can_branded_receipts: boolean;
  can_rich_reports: boolean;
  can_bulk_ops: boolean;
  can_accounting_export: boolean;
  can_advanced_analytics: boolean;
  max_students: number | null;
  future_payout_discount_bps: number;
}

export interface Membership {
  id: string;
  user_id: string;
  school_id: string;
  role: MembershipRole;
  status: "active" | "inactive";
  created_at: string;
}

export interface Subscription {
  plan_code: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_exempt: boolean;
  stripe_customer_id: string | null;
}

export interface TenantContext {
  user: { id: string; email: string };
  school: School;
  membership: Pick<Membership, "id" | "role" | "status">;
  plan: Plan;
  subscription: Subscription;
}
