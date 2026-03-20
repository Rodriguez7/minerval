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
  const { data } = await getAdminClient()
    .from("schools")
    .select("id, name, code, payment_access_token, currency, logo_url")
    .eq("payment_access_token", paymentAccessToken)
    .single();

  return (data as PaymentAccessSchool | null) ?? null;
}
