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
