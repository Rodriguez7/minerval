import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
};

export function priceIdToPlanCode(priceId: string): string | null {
  for (const [code, id] of Object.entries(PLAN_PRICE_IDS)) {
    if (id === priceId) return code;
  }
  return null;
}
