"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePaymentAccessToken } from "@/lib/payment-access";
import { createSSRClient } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import type { ReconciliationStatus } from "@/lib/types";

const ReconciliationUpdateSchema = z.object({
  paymentId: z.string().min(1),
  nextStatus: z.enum(["needs_review", "reconciled", "manual_override"]),
  note: z.string().trim().max(500).optional(),
});

async function applyReconciliationUpdate(options: {
  paymentId: string;
  nextStatus: ReconciliationStatus;
  note?: string;
  actor: string;
}) {
  const supabase = await createSSRClient();

  const { data: payment } = await supabase
    .from("payment_requests")
    .select("id, status, reconciliation_status")
    .eq("id", options.paymentId)
    .single();

  if (!payment) return;

  const now = new Date().toISOString();
  const reconciliationNote =
    options.note?.trim() ||
    (options.nextStatus === "manual_override"
      ? "Manually resolved from the reconciliation dashboard."
      : null);

  const update: {
    status?: "failed";
    reconciliation_status: ReconciliationStatus;
    reconciliation_note: string | null;
    reconciliation_updated_at: string;
    reconciliation_updated_by: string;
    updated_at: string;
  } = {
    reconciliation_status: options.nextStatus,
    reconciliation_note: reconciliationNote,
    reconciliation_updated_at: now,
    reconciliation_updated_by: options.actor,
    updated_at: now,
  };

  if (options.nextStatus === "manual_override" && payment.status === "pending") {
    update.status = "failed";
  }

  await supabase
    .from("payment_requests")
    .update(update)
    .eq("id", options.paymentId);

  await supabase.from("payment_events").insert({
    payment_request_id: options.paymentId,
    event_type: "reconciliation_updated",
    payload: {
      actor: options.actor,
      previous_payment_status: payment.status,
      previous_reconciliation_status: payment.reconciliation_status,
      next_reconciliation_status: options.nextStatus,
      note: reconciliationNote,
    },
  });
}

export async function markPaymentFailed(paymentId: string) {
  const { school } = await getTenantContext();
  const supabase = await createSSRClient();

  const { data: payment } = await supabase
    .from("payment_requests")
    .select("id, school_id, status")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.school_id !== school.id) return { error: "Not found" };
  if (payment.status !== "pending") return { error: "Only pending payments can be resolved" };

  await applyReconciliationUpdate({
    paymentId,
    nextStatus: "manual_override",
    note: "Marked failed from overview after the payment stayed pending too long.",
    actor: school.admin_email,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reconciliation");
  revalidatePath("/dashboard/reports");
  return { success: true };
}

export async function createFee(_: unknown, formData: FormData) {
  const { school } = await getTenantContext();
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

  const supabase = await createSSRClient();
  await supabase.from("fees").insert({ ...parsed.data, school_id: school.id });
  revalidatePath("/dashboard/fees");
  return { success: true };
}

export async function toggleFeeActive(feeId: string, active: boolean) {
  const { school } = await getTenantContext();
  const supabase = await createSSRClient();
  const { data: fee } = await supabase
    .from("fees")
    .select("school_id")
    .eq("id", feeId)
    .single();
  if (!fee || fee.school_id !== school.id) return;
  await supabase.from("fees").update({ active }).eq("id", feeId);
  revalidatePath("/dashboard/fees");
}

export async function addStudent(_: unknown, formData: FormData) {
  const { school } = await getTenantContext();
  const schema = z.object({
    full_name: z.string().min(1).max(200),
    class_name: z.string().max(100).optional(),
    amount_due: z.coerce.number().min(0),
  });
  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    class_name: formData.get("class_name") || undefined,
    amount_due: formData.get("amount_due"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSSRClient();
  const { data: seq, error: seqError } = await supabase
    .rpc("increment_student_seq", { p_school_id: school.id, p_count: 1 })
    .single() as { data: { prefix: string; new_seq: number } | null; error: unknown };

  if (seqError || !seq) return { error: "Failed to generate student ID." };

  const external_id = `${seq.prefix}-${String(seq.new_seq).padStart(3, "0")}`;

  const { error } = await supabase.from("students").insert({
    ...parsed.data,
    school_id: school.id,
    external_id,
  });

  if (error) return { error: "Failed to add student." };

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function regeneratePaymentAccessToken() {
  const { school } = await getTenantContext();
  const paymentAccessToken = generatePaymentAccessToken();

  await (await createSSRClient())
    .from("schools")
    .update({ payment_access_token: paymentAccessToken })
    .eq("id", school.id);

  revalidatePath("/dashboard");
}

export async function updateReconciliationStatus(formData: FormData) {
  const { school } = await getTenantContext();
  const parsed = ReconciliationUpdateSchema.safeParse({
    paymentId: formData.get("paymentId"),
    nextStatus: formData.get("nextStatus"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) return;

  const supabase = await createSSRClient();
  const { data: payment } = await supabase
    .from("payment_requests")
    .select("id, school_id, status")
    .eq("id", parsed.data.paymentId)
    .single();

  if (!payment || payment.school_id !== school.id) return;
  if (parsed.data.nextStatus === "reconciled" && payment.status === "pending") return;

  await applyReconciliationUpdate({
    paymentId: parsed.data.paymentId,
    nextStatus: parsed.data.nextStatus,
    note: parsed.data.note,
    actor: school.admin_email,
  });

  revalidatePath("/dashboard/reconciliation");
  revalidatePath("/dashboard/reports");
}
