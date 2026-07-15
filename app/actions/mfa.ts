"use server";

import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSafeAuthNext } from "@/lib/auth-redirect";
import { getPreferredLocale } from "@/lib/i18n/config";
import { createSSRClient } from "@/lib/supabase";

export type MfaActionState = {
  error?: string;
  success?: boolean;
  alreadyEnabled?: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

const codeSchema = z.string().trim().regex(/^\d{6}$/);
const idSchema = z.string().uuid();

function formLocale(formData: FormData) {
  return getPreferredLocale(formData.get("locale")?.toString());
}

function message(locale: "fr" | "en", french: string, english: string) {
  return locale === "fr" ? french : english;
}

async function authenticatedClient(locale: "fr" | "en") {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: message(locale, "Votre session a expire.", "Your session has expired."),
      supabase: null,
    };
  }
  return { error: null, supabase };
}

export async function beginTotpEnrollment(
  _: MfaActionState | null,
  formData: FormData
): Promise<MfaActionState> {
  const locale = formLocale(formData);
  const auth = await authenticatedClient(locale);
  if (!auth.supabase) return { error: auth.error ?? undefined };

  const { data: factors, error: listError } = await auth.supabase.auth.mfa.listFactors();
  if (listError) {
    return { error: message(locale, "Impossible de verifier la securite du compte.", "Could not check account security.") };
  }
  if (factors.totp.some((factor) => factor.status === "verified")) {
    return { alreadyEnabled: true };
  }

  for (const factor of factors.all.filter((item) => item.status === "unverified")) {
    await auth.supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await auth.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Minerval Authenticator",
    issuer: "Minerval",
  });
  if (error || !data?.totp) {
    return { error: message(locale, "Impossible de demarrer la configuration MFA.", "Could not start MFA setup.") };
  }

  return {
    factorId: data.id,
    qrCode: await QRCode.toDataURL(data.totp.uri, { width: 240, margin: 1 }),
    secret: data.totp.secret,
  };
}

export async function verifyTotpEnrollment(
  _: MfaActionState | null,
  formData: FormData
): Promise<MfaActionState> {
  const locale = formLocale(formData);
  const parsed = z.object({
    factorId: idSchema,
    code: codeSchema,
  }).safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: message(locale, "Saisissez le code a 6 chiffres.", "Enter the 6-digit code.") };
  }

  const auth = await authenticatedClient(locale);
  if (!auth.supabase) return { error: auth.error ?? undefined };
  const { data: factors } = await auth.supabase.auth.mfa.listFactors();
  if (!factors?.all.some((factor) => factor.id === parsed.data.factorId)) {
    return { error: message(locale, "Cette configuration MFA n'est plus valide.", "This MFA setup is no longer valid.") };
  }

  const { error } = await auth.supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    return { error: message(locale, "Code invalide ou expire.", "Invalid or expired code.") };
  }
  return { success: true };
}

export async function verifyMfaChallenge(
  _: MfaActionState | null,
  formData: FormData
): Promise<MfaActionState> {
  const locale = formLocale(formData);
  const parsed = z.object({
    factorId: idSchema,
    code: codeSchema,
  }).safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: message(locale, "Saisissez le code a 6 chiffres.", "Enter the 6-digit code.") };
  }

  const auth = await authenticatedClient(locale);
  if (!auth.supabase) return { error: auth.error ?? undefined };
  const { data: factors } = await auth.supabase.auth.mfa.listFactors();
  if (!factors?.totp.some((factor) => factor.id === parsed.data.factorId && factor.status === "verified")) {
    return { error: message(locale, "Facteur MFA introuvable.", "MFA factor not found.") };
  }

  const { error } = await auth.supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    return { error: message(locale, "Code invalide ou expire.", "Invalid or expired code.") };
  }

  redirect(getSafeAuthNext(formData.get("next")?.toString(), locale));
}

export async function disableTotp(
  _: MfaActionState | null,
  formData: FormData
): Promise<MfaActionState> {
  const locale = formLocale(formData);
  const factorId = idSchema.safeParse(formData.get("factorId"));
  if (!factorId.success) {
    return { error: message(locale, "Facteur MFA invalide.", "Invalid MFA factor.") };
  }

  const auth = await authenticatedClient(locale);
  if (!auth.supabase) return { error: auth.error ?? undefined };
  const { data: assurance } = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    return { error: message(locale, "Verifiez d'abord votre code MFA.", "Verify your MFA code first.") };
  }

  const { data: factors } = await auth.supabase.auth.mfa.listFactors();
  if (!factors?.totp.some((factor) => factor.id === factorId.data && factor.status === "verified")) {
    return { error: message(locale, "Facteur MFA introuvable.", "MFA factor not found.") };
  }

  const { error } = await auth.supabase.auth.mfa.unenroll({ factorId: factorId.data });
  if (error) {
    return { error: message(locale, "Impossible de desactiver le MFA.", "Could not disable MFA.") };
  }
  return { success: true };
}
