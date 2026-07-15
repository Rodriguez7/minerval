"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthCopy } from "@/lib/i18n/copy/auth";
import { getPreferredLocale, localizePathname } from "@/lib/i18n/config";
import { createSSRClient } from "@/lib/supabase";
import { LEGAL_VERSION } from "@/lib/legal";

function getFormLocale(formData: FormData) {
  return getPreferredLocale(formData.get("locale")?.toString());
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org").replace(
    /\/$/,
    ""
  );
}

export async function login(_: unknown, formData: FormData) {
  const locale = getFormLocale(formData);
  const copy = getAuthCopy(locale);
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: copy.actions.invalidCredentialsFormat };

  let requiresMfa = false;
  try {
    const supabase = await createSSRClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: copy.actions.invalidCredentials };

    const { data: assurance } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      assurance?.nextLevel === "aal2" &&
      assurance.currentLevel !== "aal2"
    ) {
      requiresMfa = true;
    }
  } catch {
    return { error: copy.actions.authServiceUnavailable };
  }

  if (requiresMfa) {
    const next = localizePathname(locale, "/dashboard");
    redirect(
      `${localizePathname(locale, "/mfa/verify")}?next=${encodeURIComponent(next)}`
    );
  }
  redirect(localizePathname(locale, "/dashboard"));
}

export async function resetPassword(_: unknown, formData: FormData) {
  const locale = getFormLocale(formData);
  const copy = getAuthCopy(locale);
  const email = formData.get("email");
  const parsed = z.string().email(copy.actions.validEmail).safeParse(email);
  if (!parsed.success) return { error: copy.actions.validEmail };

  try {
    const supabase = await createSSRClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getAppUrl()}${localizePathname(locale, "/reset-password")}`,
    });

    if (error) return { error: copy.actions.resetEmailFailed };
  } catch {
    return { error: copy.actions.authServiceUnavailable };
  }
  return { success: true };
}

export async function logout() {
  const supabase = await createSSRClient();
  await supabase.auth.signOut();
  redirect(localizePathname("fr", "/login"));
}

export async function signup(_: unknown, formData: FormData) {
  const locale = getFormLocale(formData);
  const copy = getAuthCopy(locale);
  const signupSchema = z.object({
    email: z.string().email(copy.actions.validEmail),
    password: z.string().min(8, copy.actions.passwordMin),
    legalAccepted: z.literal("yes"),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    legalAccepted: formData.get("legalAccepted"),
  });
  const parsed = signupSchema;
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? copy.actions.signupValidation;
    return { error: msg };
  }

  const { email, password } = parsed.data;
  try {
    const supabase = await createSSRClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getAppUrl()}${localizePathname(locale, "/onboarding/school")}`,
        data: {
          legal_version: LEGAL_VERSION,
          legal_accepted_at: new Date().toISOString(),
          locale,
        },
      },
    });
    if (authError || !authData.user) {
      return { error: authError?.message ?? copy.actions.signupFailed };
    }

    if (!authData.session) {
      return { success: true };
    }
  } catch {
    return { error: copy.actions.authServiceUnavailable };
  }

  redirect(localizePathname(locale, "/onboarding/school"));
}
