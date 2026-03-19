"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSSRClient } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";

const studentSchema = z.object({
  full_name: z.string().min(1).max(200),
  class_name: z.string().max(100).optional(),
  amount_due: z.coerce.number().min(0),
});

export async function addStudent(_: unknown, formData: FormData) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = studentSchema.safeParse({
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

export async function editStudent(_: unknown, formData: FormData) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return { error: "Unauthorized" };
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

  if (error) return { error: "Failed to update student." };

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function deleteStudent(id: string) {
  const { school, membership } = await getTenantContext();
  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createSSRClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id)
    .eq("school_id", school.id);

  if (error) return { error: "Failed to delete student." };

  revalidatePath("/dashboard/students");
  return { success: true };
}
