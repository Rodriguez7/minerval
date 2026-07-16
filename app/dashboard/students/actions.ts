"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { normalizeDrcMobilePhone } from "@/lib/phone";

const studentSchema = z.object({
  full_name: z.string().min(1).max(200),
  class_name: z.string().max(100).optional(),
  amount_due: z.coerce.number().min(0),
  balance_due_at: z.string().optional(),
  guardian_name: z.string().min(1).max(200),
  guardian_whatsapp: z.string().min(1),
  guardian_relationship: z.enum(["parent", "guardian", "payer"]),
  guardian_locale: z.literal("fr"),
  whatsapp_consent: z.literal("on"),
});

export async function addStudent(_: unknown, formData: FormData) {
  const { school, membership, plan } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const parsed = studentSchema.safeParse({
    full_name: formData.get("full_name"),
    class_name: formData.get("class_name") || undefined,
    amount_due: formData.get("amount_due"),
    balance_due_at: formData.get("balance_due_at") || undefined,
    guardian_name: formData.get("guardian_name"),
    guardian_whatsapp: formData.get("guardian_whatsapp"),
    guardian_relationship: formData.get("guardian_relationship"),
    guardian_locale: formData.get("guardian_locale"),
    whatsapp_consent: formData.get("whatsapp_consent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (parsed.data.amount_due > 0 && !parsed.data.balance_due_at) {
    return { error: "La date d'echeance est obligatoire lorsque le montant du est superieur a zero." };
  }

  const guardianPhone = normalizeDrcMobilePhone(parsed.data.guardian_whatsapp);
  if (!guardianPhone) return { error: "Numero WhatsApp RDC invalide." };

  const supabase = await createSSRClient();

  // Enforce max_students cap if the plan has one (NULL = unlimited)
  if (plan.max_students !== null) {
    const { count: currentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school.id);

    const current = currentCount ?? 0;
    if (current + 1 > plan.max_students) {
      return {
        error: `Limite d'eleves atteinte. Votre plan autorise ${plan.max_students} eleves (actuellement ${current}).`,
      };
    }
  }

  const { data, error } = await supabase.rpc("create_student_with_guardian", {
    p_school_id: school.id,
    p_full_name: parsed.data.full_name,
    p_class_name: parsed.data.class_name ?? "",
    p_amount_due: parsed.data.amount_due,
    p_balance_due_at: parsed.data.balance_due_at
      ? `${parsed.data.balance_due_at}T00:00:00.000Z`
      : null,
    p_guardian_name: parsed.data.guardian_name,
    p_guardian_phone: guardianPhone,
    p_guardian_relationship: parsed.data.guardian_relationship,
    p_guardian_locale: parsed.data.guardian_locale,
    p_opt_in_source: "manual_entry",
  });

  const result = data as { error?: string } | null;
  if (error || result?.error) {
    if (error?.message.includes("guardian_whatsapp_opted_out")) {
      return { error: "Ce numero WhatsApp s'est desabonne des rappels." };
    }
    return { error: "Impossible d'ajouter l'eleve et son responsable." };
  }

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function editStudent(_: unknown, formData: FormData) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const schema = z.object({
    id: z.string().uuid(),
    full_name: z.string().min(1).max(200),
    class_name: z.string().max(100).optional(),
    amount_due: z.coerce.number().min(0),
  });

  const parsed = schema.safeParse({
    id: formData.get("id"),
    full_name: formData.get("full_name"),
    class_name: formData.get("class_name") || undefined,
    amount_due: formData.get("amount_due"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { id, ...fields } = parsed.data;
  const supabase = await createSSRClient();

  const { error } = await supabase
    .from("students")
    .update(fields)
    .eq("id", id)
    .eq("school_id", school.id);

  if (error) return { error: "Impossible de mettre a jour l'eleve." };

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function deleteStudent(id: string) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const supabase = await createSSRClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id)
    .eq("school_id", school.id);

  if (error) return { error: "Impossible de supprimer l'eleve." };

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function setStudentReminderPause(formData: FormData) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const parsed = z.object({
    studentId: z.string().uuid(),
    mode: z.enum(["pause", "resume"]),
  }).safeParse({
    studentId: formData.get("studentId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return { error: "Action invalide" };

  const pausedUntil = parsed.data.mode === "pause"
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { error } = await getAdminClient()
    .from("students")
    .update({ reminders_paused_until: pausedUntil })
    .eq("id", parsed.data.studentId)
    .eq("school_id", school.id);

  if (error) return { error: "Impossible de mettre a jour les rappels." };
  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function setStudentGuardian(formData: FormData) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const parsed = z.object({
    studentId: z.string().uuid(),
    guardianName: z.string().min(1).max(200),
    guardianWhatsapp: z.string().min(1),
    guardianRelationship: z.enum(["parent", "guardian", "payer"]),
    guardianLocale: z.literal("fr"),
    whatsappConsent: z.literal("on"),
  }).safeParse({
    studentId: formData.get("studentId"),
    guardianName: formData.get("guardianName"),
    guardianWhatsapp: formData.get("guardianWhatsapp"),
    guardianRelationship: formData.get("guardianRelationship"),
    guardianLocale: formData.get("guardianLocale"),
    whatsappConsent: formData.get("whatsappConsent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Action invalide" };

  const phone = normalizeDrcMobilePhone(parsed.data.guardianWhatsapp);
  if (!phone) return { error: "Numero WhatsApp RDC invalide." };

  const supabase = await createSSRClient();
  const { data, error } = await supabase.rpc("set_student_primary_guardian", {
    p_school_id: school.id,
    p_student_id: parsed.data.studentId,
    p_guardian_name: parsed.data.guardianName,
    p_guardian_phone: phone,
    p_guardian_relationship: parsed.data.guardianRelationship,
    p_guardian_locale: parsed.data.guardianLocale,
  });
  const result = data as { error?: string } | null;
  if (error || result?.error) return { error: "Impossible d'enregistrer le responsable." };

  revalidatePath("/dashboard/students");
  return { success: true };
}
