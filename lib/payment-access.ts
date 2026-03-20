import { randomBytes } from "crypto";
import { getAdminClient } from "./supabase";
import type { School } from "./types";

type PaymentAccessSchool = Pick<School, "id" | "name" | "code" | "payment_access_token" | "currency" | "logo_url">;

export function generatePaymentAccessToken() {
  return randomBytes(20).toString("hex");
}

export function getSchoolPaymentUrl(paymentAccessToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const path = `/pay/access/${paymentAccessToken}`;

  return appUrl ? `${appUrl}${path}` : path;
}

export async function getSchoolByPaymentAccessToken(
  paymentAccessToken: string
): Promise<PaymentAccessSchool | null> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("schools")
    .select("id, name, code, payment_access_token, currency, logo_url")
    .eq("payment_access_token", paymentAccessToken)
    .single();

  if (!error) return (data as PaymentAccessSchool | null) ?? null;

  // Fallback: retry without logo_url. PostgREST may not have the column in
  // its schema cache yet (migration 010 added it; NOTIFY may not have reached
  // the service-role request path). Self-heals once PostgREST reloads.
  console.error("[payment-access] school lookup with logo_url failed, retrying without it:", error.message);

  const { data: fallback } = await admin
    .from("schools")
    .select("id, name, code, payment_access_token, currency")
    .eq("payment_access_token", paymentAccessToken)
    .single();

  return fallback ? ({ ...fallback, logo_url: null } as PaymentAccessSchool) : null;
}
