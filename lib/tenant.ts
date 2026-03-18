// minerval/lib/tenant.ts
import { redirect } from "next/navigation";
import { createSSRClient } from "./supabase";
import type { School, TenantContext } from "./types";

export async function getTenantContext(): Promise<TenantContext> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("school_memberships")
    .select(
      `id, role, status,
       schools (
         id, name, code, admin_email, payment_access_token,
         student_id_prefix, student_id_seq, currency, created_at,
         billing_email, billing_contact, timezone, support_tier,
         school_subscriptions (
           plan_code, status, trial_ends_at, current_period_end, billing_exempt,
           plans (
             code, name, monthly_price_usd,
             can_branded_receipts, can_rich_reports, can_bulk_ops,
             can_accounting_export, can_advanced_analytics, max_students
           )
         )
       )`
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const school = data?.schools as unknown as (School & {
    school_subscriptions: {
      plan_code: string;
      status: string;
      trial_ends_at: string | null;
      current_period_end: string | null;
      billing_exempt: boolean;
      plans: TenantContext["plan"];
    } | null;
  }) | null;

  if (!data || !school) redirect("/onboarding/school");
  if (!school.school_subscriptions || !school.school_subscriptions.plans) redirect("/login");

  const sub = school.school_subscriptions;

  return {
    user: { id: user.id, email: user.email! },
    school,
    membership: {
      id: data.id,
      role: data.role as TenantContext["membership"]["role"],
      status: data.status as "active" | "inactive",
    },
    plan: sub.plans,
    subscription: {
      plan_code: sub.plan_code,
      status: sub.status as TenantContext["subscription"]["status"],
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      billing_exempt: sub.billing_exempt,
    },
  };
}
