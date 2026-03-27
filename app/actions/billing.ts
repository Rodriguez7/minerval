"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getStripe, PLAN_PRICE_IDS } from "@/lib/stripe";

const PAID_PLAN_CODES = ["growth_monthly", "pro_monthly"] as const;

export async function createCheckoutSession(planCode: string) {
  const parsed = z.enum(PAID_PLAN_CODES).safeParse(planCode);
  if (!parsed.success) {
    return { error: "Plan invalide. Choisissez Growth ou Pro." };
  }

  const { user, school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const priceId = PLAN_PRICE_IDS[parsed.data];
  if (!priceId) {
    return { error: "Tarif du plan non configure. Contactez le support." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: school.billing_email ?? user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { school_id: school.id },
    subscription_data: {
      trial_period_days: 14,
      metadata: { school_id: school.id },
    },
    success_url: `${appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/billing`,
  });

  if (!session.url) {
    return { error: "Impossible de creer la session de paiement." };
  }

  redirect(session.url);
}

export async function createPortalSession() {
  const { subscription, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  if (!subscription.stripe_customer_id) {
    return { error: "Aucun compte de facturation trouve. Passez d'abord a un plan payant." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl}/dashboard/billing`,
  });

  redirect(session.url);
}
