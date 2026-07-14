import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportOperationalIssue } from "./operations";

type ClosureResult =
  | { ok: true; alreadyClosed: boolean }
  | {
      ok: false;
      kind: "pending_financial_activity";
      pendingPayments: number;
      pendingPayouts: number;
    }
  | { ok: false; kind: "stripe_failure" | "unauthorized" | "not_found" | "database_failure" };

type StripeSubscriptions = Pick<Stripe["subscriptions"], "retrieve" | "cancel">;

type ClosurePayload = {
  closed?: boolean;
  already_closed?: boolean;
  error?: string;
  pending_payments?: number;
  pending_payouts?: number;
};

export async function closeSchoolSafely({
  schoolId,
  reason,
  admin,
  authenticated,
  stripeSubscriptions,
}: {
  schoolId: string;
  reason: string | null;
  admin: SupabaseClient;
  authenticated: SupabaseClient;
  stripeSubscriptions: StripeSubscriptions;
}): Promise<ClosureResult> {
  const [payments, payouts] = await Promise.all([
    admin
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "pending"),
    admin
      .from("school_payouts")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["pending", "processing"]),
  ]);

  if (payments.error || payouts.error) {
    await reportOperationalIssue({
      source: "school-closure",
      message: "Could not verify pending financial activity before closure.",
      reference: schoolId,
    });
    return { ok: false, kind: "database_failure" };
  }

  const pendingPayments = payments.count ?? 0;
  const pendingPayouts = payouts.count ?? 0;
  if (pendingPayments > 0 || pendingPayouts > 0) {
    return {
      ok: false,
      kind: "pending_financial_activity",
      pendingPayments,
      pendingPayouts,
    };
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("school_subscriptions")
    .select("stripe_subscription_id, billing_exempt")
    .eq("school_id", schoolId)
    .single();

  if (subscriptionError) {
    await reportOperationalIssue({
      source: "school-closure",
      message: "Could not load the billing subscription before closure.",
      reference: schoolId,
    });
    return { ok: false, kind: "database_failure" };
  }

  const stripeSubscriptionId = subscription?.stripe_subscription_id as string | null | undefined;
  const billingExempt = subscription?.billing_exempt === true;
  let stripeWasCanceled = false;

  if (stripeSubscriptionId && !billingExempt) {
    try {
      const stripeSubscription = await stripeSubscriptions.retrieve(stripeSubscriptionId);
      if (stripeSubscription.status !== "canceled") {
        await stripeSubscriptions.cancel(stripeSubscriptionId);
        stripeWasCanceled = true;
      }
    } catch {
      await reportOperationalIssue({
        source: "school-closure",
        message: "Stripe subscription cancellation failed; school closure was not attempted.",
        reference: schoolId,
      });
      return { ok: false, kind: "stripe_failure" };
    }
  }

  const { data, error } = await authenticated.rpc("close_school", {
    p_school_id: schoolId,
    p_reason: reason,
  });
  const payload = (data ?? {}) as ClosurePayload;

  if (error) {
    await reportDatabaseFailure(schoolId, stripeWasCanceled);
    return { ok: false, kind: "database_failure" };
  }

  if (payload.error === "pending_financial_activity") {
    await reportOperationalIssue({
      source: "school-closure",
      severity: stripeWasCanceled ? "critical" : "warning",
      message: stripeWasCanceled
        ? "Financial activity appeared after preflight; Stripe was canceled but school closure was blocked."
        : "Financial activity appeared after preflight; school closure was blocked.",
      reference: schoolId,
    });
    return {
      ok: false,
      kind: "pending_financial_activity",
      pendingPayments: payload.pending_payments ?? 0,
      pendingPayouts: payload.pending_payouts ?? 0,
    };
  }
  if (payload.error === "unauthorized") return { ok: false, kind: "unauthorized" };
  if (payload.error === "not_found") return { ok: false, kind: "not_found" };
  if (payload.closed === true) {
    return { ok: true, alreadyClosed: payload.already_closed === true };
  }

  await reportDatabaseFailure(schoolId, stripeWasCanceled);
  return { ok: false, kind: "database_failure" };
}

async function reportDatabaseFailure(schoolId: string, stripeWasCanceled: boolean) {
  await reportOperationalIssue({
    source: "school-closure",
    severity: stripeWasCanceled ? "critical" : "warning",
    message: stripeWasCanceled
      ? "Stripe was canceled but the database closure did not complete; a safe retry is required."
      : "The database closure did not complete.",
    reference: schoolId,
  });
}
