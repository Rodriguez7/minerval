"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { EDUCATION_LEVELS } from "@/lib/congo-education";

const PricingSchema = z.object({
  parentFeeBps: z.coerce.number().int().min(0).max(1000),
  feeDisplayMode: z.enum(["visible_line_item", "hidden"]),
});

const WhatsAppSettingsSchema = z.object({
  automaticRemindersEnabled: z.boolean(),
  localSendHour: z.coerce.number().int().min(0).max(23),
  maxReminders: z.coerce.number().int().min(1).max(6),
});

type State = { error?: string; success?: boolean } | undefined;

const EducationLevelsSchema = z
  .array(z.enum(EDUCATION_LEVELS))
  .min(1, "Selectionnez au moins un niveau d'enseignement.");

export async function updateEducationLevels(
  _: State,
  formData: FormData
): Promise<State> {
  const { school, membership } = await getTenantContext();
  if (!['owner', 'admin'].includes(membership.role)) {
    return { error: "Non autorise" };
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

  if (error) return { error: "Impossible de mettre a jour les niveaux." };

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
    return { error: "Non autorise" };
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

  if (error) return { error: "Impossible de mettre a jour la politique tarifaire." };

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateWhatsAppSettings(
  _: State,
  formData: FormData
): Promise<State> {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorise" };
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

  if (error) return { error: "Impossible de mettre a jour les rappels WhatsApp." };
  revalidatePath("/dashboard/settings");
  return { success: true };
}
