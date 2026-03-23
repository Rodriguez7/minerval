import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

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
