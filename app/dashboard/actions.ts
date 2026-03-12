"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { getAuthenticatedSchool } from "@/lib/auth";

export async function markPaymentFailed(paymentId: string) {
  const school = await getAuthenticatedSchool();
  const admin = getAdminClient();

  const { data: payment } = await admin
    .from("payment_requests")
    .select("id, school_id, status")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.school_id !== school.id) return { error: "Not found" };
  if (payment.status !== "pending") return { error: "Only pending payments can be resolved" };

  await admin
    .from("payment_requests")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("id", paymentId);

  await admin.from("payment_events").insert({
    payment_request_id: paymentId,
    event_type: "manual_resolution",
    payload: { resolved_by: school.admin_email },
  });

  revalidatePath("/dashboard");
  return { success: true };
}

export async function createFee(_: unknown, formData: FormData) {
  const school = await getAuthenticatedSchool();
  const schema = z.object({
    title: z.string().min(1),
    type: z.enum(["recurring", "special"]),
    amount: z.coerce.number().positive(),
  });
  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await getAdminClient().from("fees").insert({ ...parsed.data, school_id: school.id });
  revalidatePath("/dashboard/fees");
  return { success: true };
}

export async function toggleFeeActive(feeId: string, active: boolean) {
  const school = await getAuthenticatedSchool();
  const { data: fee } = await getAdminClient()
    .from("fees")
    .select("school_id")
    .eq("id", feeId)
    .single();
  if (!fee || fee.school_id !== school.id) return;
  await getAdminClient().from("fees").update({ active }).eq("id", feeId);
  revalidatePath("/dashboard/fees");
}

export async function addStudent(_: unknown, formData: FormData) {
  const school = await getAuthenticatedSchool();
  const schema = z.object({
    external_id: z.string().min(1).max(50),
    full_name: z.string().min(1).max(200),
    class_name: z.string().max(100).optional(),
    amount_due: z.coerce.number().min(0),
  });
  const parsed = schema.safeParse({
    external_id: formData.get("external_id"),
    full_name: formData.get("full_name"),
    class_name: formData.get("class_name") || undefined,
    amount_due: formData.get("amount_due"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { error } = await getAdminClient().from("students").insert({
    ...parsed.data,
    school_id: school.id,
  });

  if (error?.code === "23505") return { error: "A student with this ID already exists." };
  if (error) return { error: "Failed to add student." };

  revalidatePath("/dashboard/students");
  return { success: true };
}
