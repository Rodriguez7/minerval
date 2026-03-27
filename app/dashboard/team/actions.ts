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
  if (!parsed.success) return { error: "Role invalide." };

  const { user, school, membership } = await getTenantContext();

  if (!AUTHORIZED_ROLES.includes(membership.role as typeof AUTHORIZED_ROLES[number])) {
    return { error: "Non autorise" };
  }

  const target = await getTargetMembership(memberId, school.id);
  if (!target) return { error: "Introuvable" };
  if (target.user_id === user.id) return { error: "Impossible de modifier votre propre role." };

  const admin = getAdminClient();
  const { error } = await admin
    .from("school_memberships")
    .update({ role: parsed.data })
    .eq("id", memberId);

  if (error) return { error: "Impossible de mettre a jour le role." };

  revalidatePath("/dashboard/team");
}

export async function deactivateMember(memberId: string) {
  const { user, school, membership } = await getTenantContext();

  if (!AUTHORIZED_ROLES.includes(membership.role as typeof AUTHORIZED_ROLES[number])) {
    return { error: "Non autorise" };
  }

  const target = await getTargetMembership(memberId, school.id);
  if (!target) return { error: "Introuvable" };
  if (target.user_id === user.id) return { error: "Impossible de desactiver votre propre acces." };

  const admin = getAdminClient();
  const { error } = await admin
    .from("school_memberships")
    .update({ status: "inactive" })
    .eq("id", memberId);

  if (error) return { error: "Impossible de desactiver ce membre." };

  revalidatePath("/dashboard/team");
}

export async function sendInvite(email: string, role: string) {
  // Authorization first — fail fast
  const { user, school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Non autorise" };
  }

  const parsed = z
    .object({
      email: z.string().email(),
      role: z.enum(["admin", "finance", "viewer"]),
    })
    .safeParse({ email, role });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entree invalide" };
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
    return { error: "Impossible de creer l'invitation." };
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
