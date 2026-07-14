import type { SupabaseClient } from "@supabase/supabase-js";
import { collectAllPages } from "./paged-query";

export const SCHOOL_EXPORT_SCHEMA_VERSION = 1;

export async function buildSchoolExport(
  admin: SupabaseClient,
  schoolId: string,
  generatedAt = new Date().toISOString()
) {
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select(
      "id, name, code, admin_email, created_at, billing_email, billing_contact, timezone, support_tier, student_id_prefix, currency, logo_url, legal_name, registration_number, school_address, director_name, director_phone, payout_account_name, payout_account_phone, verification_status, verification_submitted_at, verification_reviewed_at, education_levels, status, closed_at, closed_by, closure_reason"
    )
    .eq("id", schoolId)
    .single();

  if (schoolError || !school) {
    throw new Error(schoolError?.message ?? "School export failed");
  }

  const [
    students,
    fees,
    payments,
    paymentEvents,
    payouts,
    memberships,
    invites,
    subscriptions,
    pricingPolicies,
    billingEvents,
  ] = await Promise.all([
    loadRows(admin, "students", "*", schoolId),
    loadRows(admin, "fees", "*", schoolId),
    loadRows(admin, "payment_requests", "*", schoolId),
    collectAllPages<Record<string, unknown>>(async (from, to) => {
      const result = await admin
        .from("payment_events")
        .select("*, payment_requests!inner(school_id)")
        .eq("payment_requests.school_id", schoolId)
        .order("created_at", { ascending: true })
        .range(from, to);
      return {
        error: result.error,
        data: (result.data ?? []).map((row) => {
          const event = { ...(row as Record<string, unknown>) };
          delete event.payment_requests;
          return event;
        }),
      };
    }),
    loadRows(admin, "school_payouts", "*", schoolId),
    loadRows(
      admin,
      "school_memberships",
      "id, user_id, role, status, created_at",
      schoolId
    ),
    loadRows(
      admin,
      "school_invites",
      "id, email, role, invited_by, accepted_at, expires_at, created_at",
      schoolId
    ),
    loadRows(admin, "school_subscriptions", "*", schoolId),
    loadRows(admin, "school_pricing_policies", "*", schoolId),
    loadRows(
      admin,
      "billing_events",
      "id, school_id, stripe_event_id, event_type, created_at",
      schoolId
    ),
  ]);

  return {
    schema_version: SCHOOL_EXPORT_SCHEMA_VERSION,
    generated_at: generatedAt,
    school,
    students,
    fees,
    payments,
    payment_events: paymentEvents,
    payouts,
    memberships,
    invites,
    subscriptions,
    pricing_policies: pricingPolicies,
    billing_events: billingEvents,
  };
}

function loadRows(
  admin: SupabaseClient,
  table: string,
  columns: string,
  schoolId: string
) {
  return collectAllPages<Record<string, unknown>>(async (from, to) => {
    const result = await admin
      .from(table)
      .select(columns)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: true })
      .range(from, to);
    return {
      error: result.error,
      data: (result.data ?? []) as unknown as Record<string, unknown>[],
    };
  });
}
