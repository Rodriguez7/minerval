"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { EDUCATION_LEVELS } from "@/lib/congo-education";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { getPreferredLocale } from "@/lib/i18n/config";
import { sendSchoolVerificationDecisionEmail } from "@/lib/email";

const PricingSchema = z.object({
  parentFeeBps: z.coerce.number().int().min(0).max(1000),
  feeDisplayMode: z.enum(["visible_line_item", "hidden"]),
});

const WhatsAppSettingsSchema = z.object({
  automaticRemindersEnabled: z.boolean(),
  localSendHour: z.coerce.number().int().min(0).max(23),
  maxReminders: z.coerce.number().int().min(1).max(6),
});

const VerificationProfileSchema = z.object({
  legalName: z.string().min(2).max(200),
  registrationNumber: z.string().max(100).optional(),
  schoolAddress: z.string().min(5).max(300),
  directorName: z.string().min(2).max(200),
  directorPhone: z.string().max(30).optional(),
  payoutAccountName: z.string().max(200).optional(),
  payoutAccountPhone: z.string().max(30).optional(),
  currency: z.enum(["FC", "USD"]),
});

type State = { error?: string; success?: boolean; message?: string } | undefined;

const EducationLevelsSchema = z
  .array(z.enum(EDUCATION_LEVELS))
  .min(1, "Sélectionnez au moins un niveau d’enseignement.");

export async function updateEducationLevels(
  _: State,
  formData: FormData
): Promise<State> {
  const { school, membership } = await getTenantContext();
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: "Non autorisé" };
  }

  const parsed = EducationLevelsSchema.safeParse(
    formData.getAll("educationLevels")
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Erreur de validation" };
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ education_levels: parsed.data })
    .eq("id", school.id);

  if (error) return { error: "Impossible de mettre à jour les niveaux." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function updatePricingPolicy(
  _: State,
  formData: FormData
): Promise<State> {
  // Authorization before validation — consistent with changeMemberRole / deactivateMember
  const { school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorisé" };
  }

  const parsed = PricingSchema.safeParse({
    parentFeeBps: formData.get("parentFeeBps"),
    feeDisplayMode: formData.get("feeDisplayMode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Erreur de validation" };
  }

  const admin = getAdminClient();
  const { error } = await admin
    .from("school_pricing_policies")
    .upsert(
      {
        school_id: school.id,
        parent_fee_bps: parsed.data.parentFeeBps,
        fee_display_mode: parsed.data.feeDisplayMode,
      },
      { onConflict: "school_id" }
    );

  if (error) return { error: "Impossible de mettre à jour la politique tarifaire." };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateWhatsAppSettings(
  _: State,
  formData: FormData
): Promise<State> {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorisé" };
  }

  const parsed = WhatsAppSettingsSchema.safeParse({
    automaticRemindersEnabled: formData.get("automaticRemindersEnabled") === "on",
    localSendHour: formData.get("localSendHour"),
    maxReminders: formData.get("maxReminders"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Erreur de validation" };
  }

  const { error } = await getAdminClient()
    .from("school_whatsapp_settings")
    .upsert(
      {
        school_id: school.id,
        automatic_reminders_enabled: parsed.data.automaticRemindersEnabled,
        local_send_hour: parsed.data.localSendHour,
        max_reminders: parsed.data.maxReminders,
        paused_until: null,
      },
      { onConflict: "school_id" }
    );

  if (error) return { error: "Impossible de mettre à jour les rappels WhatsApp." };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function submitSchoolVerification(
  _: State,
  formData: FormData
): Promise<State> {
  const locale = getPreferredLocale(formData.get("locale")?.toString());
  const fr = locale === "fr";
  const { school, membership } = await getTenantContext();
  if (membership.role !== "owner") {
    return { error: fr ? "Seul le propriétaire peut soumettre la vérification." : "Only the owner can submit verification." };
  }

  const parsed = VerificationProfileSchema.safeParse({
    legalName: formData.get("legalName"),
    registrationNumber: formData.get("registrationNumber")?.toString() || undefined,
    schoolAddress: formData.get("schoolAddress"),
    directorName: formData.get("directorName"),
    directorPhone: formData.get("directorPhone")?.toString() || undefined,
    payoutAccountName: formData.get("payoutAccountName")?.toString() || undefined,
    payoutAccountPhone: formData.get("payoutAccountPhone")?.toString() || undefined,
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (fr ? "Profil incomplet." : "Incomplete profile.") };
  }

  const directorPhone = parsed.data.directorPhone
    ? normalizeWhatsAppPhone(parsed.data.directorPhone)
    : null;
  const payoutPhone = parsed.data.payoutAccountPhone
    ? normalizeDrcMobilePhoneForPayout(parsed.data.payoutAccountPhone)
    : null;
  if (parsed.data.directorPhone && !directorPhone) {
    return { error: fr ? "Numéro international du responsable invalide." : "Invalid director phone number." };
  }
  if (parsed.data.payoutAccountPhone && !payoutPhone) {
    return { error: fr ? "Le compte de versement doit utiliser un numéro mobile RDC." : "The payout account must use a DRC mobile number." };
  }

  const { error } = await getAdminClient()
    .from("schools")
    .update({
      legal_name: parsed.data.legalName,
      registration_number: parsed.data.registrationNumber ?? null,
      school_address: parsed.data.schoolAddress,
      director_name: parsed.data.directorName,
      director_phone: directorPhone,
      payout_account_name: parsed.data.payoutAccountName ?? null,
      payout_account_phone: payoutPhone,
      currency: parsed.data.currency,
      verification_status: "pending",
      verification_submitted_at: new Date().toISOString(),
      verification_reviewed_at: null,
      verification_rejection_reason: null,
    })
    .eq("id", school.id);

  if (error) {
    return { error: fr ? "Impossible de soumettre la vérification." : "Could not submit verification." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function reviewSchoolVerification(
  _: State,
  formData: FormData
): Promise<State> {
  const ssr = await createSSRClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return { error: "Unauthorized" };
  }

  const parsed = z.object({
    schoolId: z.string().uuid(),
    decision: z.enum(["verified", "rejected"]),
    note: z.string().max(1000).optional(),
  }).safeParse({
    schoolId: formData.get("schoolId"),
    decision: formData.get("decision"),
    note: formData.get("note")?.toString().trim() || undefined,
  });
  if (!parsed.success) return { error: "Dossier ou décision invalide." };
  if (parsed.data.decision === "rejected" && !parsed.data.note) {
    return { error: "Indiquez les corrections demandées avant de continuer." };
  }

  const admin = getAdminClient();
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id,name,admin_email")
    .eq("id", parsed.data.schoolId)
    .maybeSingle();
  if (schoolError || !school) return { error: "Établissement introuvable." };
  if (parsed.data.decision === "verified") {
    const { count: documentCount, error: documentError } = await admin
      .from("school_verification_documents")
      .select("id", { count: "exact", head: true })
      .eq("school_id", parsed.data.schoolId);
    if (documentError) {
      return { error: "Impossible de vérifier les documents du dossier." };
    }
    if (!documentCount) {
      return {
        error:
          "Ajoutez au moins un document officiel avant d’approuver l’établissement.",
      };
    }
  }

  const reviewedAt = new Date().toISOString();
  const { error } = await admin
    .from("schools")
    .update({
      verification_status: parsed.data.decision,
      verification_reviewed_at: reviewedAt,
      verification_rejection_reason:
        parsed.data.decision === "rejected" ? parsed.data.note : null,
    })
    .eq("id", parsed.data.schoolId);
  if (error) return { error: "Impossible de mettre à jour la vérification." };

  const { error: auditError } = await admin.from("school_verification_reviews").insert({
    school_id: parsed.data.schoolId,
    reviewer_id: user.id,
    decision: parsed.data.decision,
    note: parsed.data.note ?? null,
  });
  if (auditError) {
    return {
      error:
        "La décision a été enregistrée, mais le journal d’audit n’a pas pu être mis à jour.",
    };
  }

  try {
    await sendSchoolVerificationDecisionEmail({
      to: school.admin_email,
      schoolName: school.name,
      decision: parsed.data.decision,
      note: parsed.data.note,
    });
  } catch (emailError) {
    console.error("School verification notification failed", emailError);
  }

  revalidatePath("/admin/schools");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return {
    success: true,
    message:
      parsed.data.decision === "verified"
        ? "Établissement approuvé. L’école peut voir la décision dans ses paramètres."
        : "Corrections demandées. Le motif est maintenant visible par l’école.",
  };
}

function normalizeDrcMobilePhoneForPayout(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhatsAppPhone(value);
  return normalized?.startsWith("243") && normalized.length === 12 ? normalized : null;
}
