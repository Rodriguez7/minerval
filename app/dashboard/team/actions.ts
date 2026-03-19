"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const AUTHORIZED_ROLES = ["owner", "admin"] as const;

async function getTargetMembership(memberId: string, schoolId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("school_memberships")
    .select("id, user_id, role, school_id, status")
    .eq("id", memberId)
    .single();

  if (error || !data || data.school_id !== schoolId) return null;
  return data;
}

export async function changeMemberRole(memberId: string, newRole: string) {
  const parsed = z.enum(["owner", "admin", "finance", "viewer"]).safeParse(newRole);
  if (!parsed.success) return { error: "Invalid role." };

  const { user, school, membership } = await getTenantContext();

  if (!AUTHORIZED_ROLES.includes(membership.role as typeof AUTHORIZED_ROLES[number])) {
    return { error: "Unauthorized" };
  }

  const target = await getTargetMembership(memberId, school.id);
  if (!target) return { error: "Not found" };
  if (target.user_id === user.id) return { error: "Cannot change your own role." };

  const admin = getAdminClient();
  const { error } = await admin
    .from("school_memberships")
    .update({ role: parsed.data })
    .eq("id", memberId);

  if (error) return { error: "Failed to update role." };

  revalidatePath("/dashboard/team");
}

export async function deactivateMember(memberId: string) {
  const { user, school, membership } = await getTenantContext();

  if (!AUTHORIZED_ROLES.includes(membership.role as typeof AUTHORIZED_ROLES[number])) {
    return { error: "Unauthorized" };
  }

  const target = await getTargetMembership(memberId, school.id);
  if (!target) return { error: "Not found" };
  if (target.user_id === user.id) return { error: "Cannot deactivate your own membership." };

  const admin = getAdminClient();
  const { error } = await admin
    .from("school_memberships")
    .update({ status: "inactive" })
    .eq("id", memberId);

  if (error) return { error: "Failed to deactivate member." };

  revalidatePath("/dashboard/team");
}

export async function sendInvite(email: string, role: string) {
  // Authorization first — fail fast
  const { user, school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = z
    .object({
      email: z.string().email(),
      role: z.enum(["admin", "finance", "viewer"]),
    })
    .safeParse({ email, role });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const admin = getAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Insert invite row to get the token
  const { data: invite, error: inviteInsertError } = await admin
    .from("school_invites")
    .insert({
      school_id: school.id,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (inviteInsertError || !invite) {
    return { error: "Failed to create invite." };
  }

  const acceptUrl = `${appUrl}/invite/accept?token=${invite.token}`;

  // Try to send invite email via Supabase Auth (works for new users)
  const { error: authInviteError } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: acceptUrl }
  );

  if (authInviteError) {
    // User already has an account — find them and add membership directly.
    // perPage: 1000 ensures we don't silently miss users in tenants with >50 auth accounts.
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users.find((u) => u.email === parsed.data.email);
    if (existing) {
      await admin.from("school_memberships").upsert(
        {
          user_id: existing.id,
          school_id: school.id,
          role: parsed.data.role,
          status: "active",
        },
        { onConflict: "user_id,school_id" }
      );
    }
  }

  revalidatePath("/dashboard/team");
  return { inviteLink: acceptUrl };
}
