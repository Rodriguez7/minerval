import type { SupabaseClient } from "@supabase/supabase-js";
import { reportOperationalIssue } from "./operations";

export type UserDeletionResult =
  | { ok: true }
  | { ok: false; kind: "active_owner"; schools: string[] }
  | { ok: false; kind: "invalid_password" | "database_failure" | "auth_failure" };

export async function deletePersonalAccount({
  userId,
  email,
  password,
  authenticated,
  admin,
}: {
  userId: string;
  email: string;
  password: string;
  authenticated: SupabaseClient;
  admin: SupabaseClient;
}): Promise<UserDeletionResult> {
  const { data: ownerships, error: ownershipError } = await admin
    .from("school_memberships")
    .select("school_id")
    .eq("user_id", userId)
    .eq("role", "owner");

  if (ownershipError) {
    await reportFailure(userId, "Could not verify school ownership before account deletion.");
    return { ok: false, kind: "database_failure" };
  }

  const schoolIds = (ownerships ?? []).map((row) => row.school_id as string);
  if (schoolIds.length > 0) {
    const { data: schools, error: schoolsError } = await admin
      .from("schools")
      .select("id, name")
      .in("id", schoolIds)
      .eq("status", "active");

    if (schoolsError) {
      await reportFailure(userId, "Could not verify active schools before account deletion.");
      return { ok: false, kind: "database_failure" };
    }
    if (schools && schools.length > 0) {
      return {
        ok: false,
        kind: "active_owner",
        schools: schools.map((school) => school.name as string),
      };
    }
  }

  const { error: passwordError } = await authenticated.auth.signInWithPassword({
    email,
    password,
  });
  if (passwordError) return { ok: false, kind: "invalid_password" };

  const { error: deletionError } = await admin.auth.admin.deleteUser(userId);
  if (deletionError) {
    await reportFailure(userId, "Supabase identity deletion failed.");
    return { ok: false, kind: "auth_failure" };
  }

  await cleanupPersonalEmail(admin, email, userId);
  await authenticated.auth.signOut();
  return { ok: true };
}

async function cleanupPersonalEmail(admin: SupabaseClient, email: string, userId: string) {
  const anonymizedEmail = "deleted-account@minerval.invalid";
  const results = await Promise.all([
    admin.from("school_invites").delete().eq("email", email),
    admin
      .from("schools")
      .update({ admin_email: anonymizedEmail })
      .eq("admin_email", email)
      .eq("status", "closed"),
    admin.from("schools").update({ billing_email: null }).eq("billing_email", email),
  ]);

  const cleanupError = results.find((result) => result.error)?.error;
  if (cleanupError) {
    await reportOperationalIssue({
      source: "user-account-deletion",
      severity: "warning",
      message: "Identity was deleted, but some personal email cleanup did not complete.",
      reference: userId,
    });
  }
}

async function reportFailure(userId: string, message: string) {
  await reportOperationalIssue({
    source: "user-account-deletion",
    message,
    reference: userId,
  });
}
