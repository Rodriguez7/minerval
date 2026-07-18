import { createHash, randomBytes } from "crypto";
import { getAdminClient } from "./supabase";

export function hashStudentPaymentToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateStudentPaymentToken() {
  return randomBytes(32).toString("base64url");
}

export async function createStudentPaymentLink(opts: {
  schoolId: string;
  studentId: string;
  reminderCycleId: string;
  expiresAt?: Date;
}) {
  const token = generateStudentPaymentToken();
  const tokenHash = hashStudentPaymentToken(token);
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const { data, error } = await getAdminClient()
    .from("student_payment_links")
    .insert({
      school_id: opts.schoolId,
      student_id: opts.studentId,
      reminder_cycle_id: opts.reminderCycleId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create student payment link: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.id as string, token, expiresAt };
}

export async function revokeStudentPaymentLink(id: string) {
  await getAdminClient()
    .from("student_payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
}

export async function resolveStudentPaymentToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;

  const admin = getAdminClient();
  const { data: link, error: linkError } = await admin
    .from("student_payment_links")
    .select("id, school_id, student_id, reminder_cycle_id, expires_at, revoked_at")
    .eq("token_hash", hashStudentPaymentToken(token))
    .single();

  if (
    linkError ||
    !link ||
    link.revoked_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const [{ data: student }, { data: school }] = await Promise.all([
    admin
      .from("students")
      .select("id, external_id, full_name, class_name, amount_due, reminder_cycle_id")
      .eq("id", link.student_id)
      .eq("school_id", link.school_id)
      .single(),
    admin
      .from("schools")
      .select("id, name, currency, logo_url, payment_access_token, status")
      .eq("id", link.school_id)
      .single(),
  ]);

  if (
    !student ||
    !school ||
    school.status !== "active" ||
    student.reminder_cycle_id !== link.reminder_cycle_id ||
    Number(student.amount_due) <= 0
  ) {
    return null;
  }

  return { link, student, school };
}
