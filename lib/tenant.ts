// minerval/lib/tenant.ts
import { redirect } from "next/navigation";
import { createSSRClient } from "./supabase";
import { takeJoined, type MaybeJoined } from "./supabase-joins";
import type { School, TenantContext } from "./types";

const TENANT_PLAN_SELECT = `
  code, name, monthly_price_usd,
  can_branded_receipts, can_rich_reports, can_bulk_ops,
  can_accounting_export, can_advanced_analytics, max_students,
  future_payout_discount_bps
`;

const TENANT_SUBSCRIPTION_SELECT = `
  plan_code, status, trial_ends_at, current_period_end, billing_exempt, stripe_customer_id,
  plans (${TENANT_PLAN_SELECT})
`;

const TENANT_SCHOOL_SELECT = `
  id, name, code, admin_email, payment_access_token,
  student_id_prefix, student_id_seq, currency, created_at,
  education_levels,
  billing_email, billing_contact, timezone, support_tier,
  logo_url, verification_status, legal_name, registration_number,
  school_address, director_name, director_phone, payout_account_name,
  payout_account_phone, verification_submitted_at, verification_reviewed_at,
  verification_rejection_reason,
  school_subscriptions (${TENANT_SUBSCRIPTION_SELECT})
`;

const TENANT_SCHOOL_FALLBACK_SELECT = `
  id, name, code, admin_email, payment_access_token,
  student_id_prefix, student_id_seq, currency, created_at,
  billing_email, billing_contact, timezone,
  school_subscriptions (${TENANT_SUBSCRIPTION_SELECT})
`;

function isMissingColumnError(message: string | undefined) {
  return Boolean(message && message.includes("column") && message.includes("does not exist"));
}

export async function getTenantContext(): Promise<TenantContext> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const primaryResult = await supabase
    .from("school_memberships")
    .select(
      `id, role, status, schools (${TENANT_SCHOOL_SELECT})`
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  let membershipData: {
    id: string;
    role: string;
    status: string;
    schools: MaybeJoined<SchoolRow>;
  } | null = primaryResult.data as {
    id: string;
    role: string;
    status: string;
    schools: MaybeJoined<SchoolRow>;
  } | null;

  if (primaryResult.error && isMissingColumnError(primaryResult.error.message)) {
    const fallbackResult = await supabase
      .from("school_memberships")
      .select(`id, role, status, schools (${TENANT_SCHOOL_FALLBACK_SELECT})`)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    membershipData = fallbackResult.data
      ? ({
          ...fallbackResult.data,
          schools: takeJoined(fallbackResult.data.schools as MaybeJoined<Record<string, unknown>>)
            ? ({
                support_tier: "standard",
                education_levels: ["preschool", "primary", "secondary"],
                logo_url: null,
                verification_status: "unverified",
                legal_name: null,
                registration_number: null,
                school_address: null,
                director_name: null,
                director_phone: null,
                payout_account_name: null,
                payout_account_phone: null,
                verification_submitted_at: null,
                verification_reviewed_at: null,
                verification_rejection_reason: null,
                ...takeJoined(fallbackResult.data.schools as MaybeJoined<Record<string, unknown>>),
              } as SchoolRow)
            : null,
        } as {
          id: string;
          role: string;
          status: string;
          schools: MaybeJoined<SchoolRow>;
        })
      : null;
  }

  type SubscriptionRow = {
    plan_code: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    billing_exempt: boolean;
    stripe_customer_id: string | null;
    plans: MaybeJoined<TenantContext["plan"]>;
  };

  type SchoolRow = School & {
    school_subscriptions: MaybeJoined<SubscriptionRow>;
  };

  const school = takeJoined(membershipData?.schools as MaybeJoined<SchoolRow>);
  const sub = takeJoined(school?.school_subscriptions ?? null);
  const plan = takeJoined(sub?.plans ?? null);

  if (!membershipData || !school) redirect("/onboarding/school");
  if (!sub || !plan) redirect("/login");

  return {
    user: { id: user.id, email: user.email! },
    school,
    membership: {
      id: membershipData.id,
      role: membershipData.role as TenantContext["membership"]["role"],
      status: membershipData.status as "active" | "inactive",
    },
    plan,
    subscription: {
      plan_code: sub.plan_code,
      status: sub.status as TenantContext["subscription"]["status"],
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      billing_exempt: sub.billing_exempt,
      stripe_customer_id: sub.stripe_customer_id,
    },
  };
}
