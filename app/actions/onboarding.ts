"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { getPreferredLocale } from "@/lib/i18n/config";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

function getFormLocale(formData: FormData) {
  return getPreferredLocale(formData.get("locale")?.toString());
}

export async function createSchool(_: unknown, formData: FormData) {
  const locale = getFormLocale(formData);
  const copy = getOnboardingCopy(locale);
  const schoolSchema = z.object({
    schoolName: z.string().min(2).max(200),
    legalName: z.string().min(2).max(200),
    registrationNumber: z.string().max(100).optional(),
    schoolAddress: z.string().min(5).max(300),
    directorName: z.string().min(2).max(200),
    directorPhone: z.string().regex(/^\+?[0-9\s().-]{9,20}$/, "Numero du directeur invalide"),
    payoutAccountName: z.string().min(2).max(200),
    payoutAccountPhone: z.string().regex(/^\+?[0-9\s().-]{9,20}$/, "Numero de versement invalide"),
    schoolCode: z
      .string()
      .regex(/^[a-z0-9-]+$/, copy.actions.invalidSchoolCode)
      .min(2)
      .max(30),
    studentIdPrefix: z
      .string()
      .regex(/^[A-Z0-9]{2,6}$/, copy.actions.invalidStudentIdPrefix),
    currency: z.enum(["FC", "USD"]),
  });
  const parsed = schoolSchema.safeParse({
    schoolName: formData.get("schoolName"),
    legalName: formData.get("legalName"),
    registrationNumber: formData.get("registrationNumber")?.toString() || undefined,
    schoolAddress: formData.get("schoolAddress"),
    directorName: formData.get("directorName"),
    directorPhone: formData.get("directorPhone"),
    payoutAccountName: formData.get("payoutAccountName"),
    payoutAccountPhone: formData.get("payoutAccountPhone"),
    schoolCode: formData.get("schoolCode"),
    studentIdPrefix: formData.get("studentIdPrefix"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? copy.actions.validationError;
    return { error: msg };
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("schools")
    .select("id")
    .eq("code", parsed.data.schoolCode)
    .maybeSingle();
  if (lookupError) return { error: copy.actions.failedCheckAvailability };
  if (existing) return { error: copy.actions.schoolCodeTaken };

  const { data: newSchool, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: parsed.data.schoolName,
      code: parsed.data.schoolCode,
      admin_email: user.email!,
      student_id_prefix: parsed.data.studentIdPrefix,
      currency: parsed.data.currency,
      legal_name: parsed.data.legalName,
      registration_number: parsed.data.registrationNumber ?? null,
      school_address: parsed.data.schoolAddress,
      director_name: parsed.data.directorName,
      director_phone: parsed.data.directorPhone,
      payout_account_name: parsed.data.payoutAccountName,
      payout_account_phone: parsed.data.payoutAccountPhone,
      verification_status: "pending",
      verification_submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (schoolError || !newSchool) return { error: copy.actions.failedCreateSchool };

  const { error: membershipError } = await admin.from("school_memberships").insert({
    user_id: user.id,
    school_id: newSchool.id,
    role: "owner",
    status: "active",
  });
  if (membershipError) return { error: copy.actions.failedCompleteSetup };

  const { error: subscriptionError } = await admin.from("school_subscriptions").insert({
    school_id: newSchool.id,
    plan_code: "starter_free",
    status: "active",
    billing_exempt: false,
  });
  if (subscriptionError) return { error: copy.actions.failedCompleteSetup };

  const { error: pricingError } = await admin.from("school_pricing_policies").insert({
    school_id: newSchool.id,
    parent_fee_bps: 275,
    fee_display_mode: "visible_line_item",
    active: true,
  });
  if (pricingError) return { error: copy.actions.failedCompleteSetup };

  redirect("/onboarding/billing-contact");
}

export async function updateBillingContact(_: unknown, formData: FormData) {
  const locale = getFormLocale(formData);
  const copy = getOnboardingCopy(locale);
  const billingContactSchema = z.object({
    billingEmail: z.string().email(),
    billingContact: z.string().min(2).max(200),
    timezone: z.string().min(1),
  });
  const parsed = billingContactSchema.safeParse({
    billingEmail: formData.get("billingEmail"),
    billingContact: formData.get("billingContact"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? copy.actions.validationError;
    return { error: msg };
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get the user's school via membership (SSR client — RLS enforced)
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("status", "active")
    .single();

  if (!membership) redirect("/onboarding/school");

  const { error } = await supabase
    .from("schools")
    .update({
      billing_email: parsed.data.billingEmail,
      billing_contact: parsed.data.billingContact,
      timezone: parsed.data.timezone,
    })
    .eq("id", membership.school_id);

  if (error) return { error: copy.actions.failedUpdateBilling };

  redirect("/onboarding/import");
}
