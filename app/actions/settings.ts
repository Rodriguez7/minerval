"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const PricingSchema = z.object({
  parentFeeBps: z.coerce.number().int().min(0).max(1000),
  feeDisplayMode: z.enum(["visible_line_item", "hidden"]),
});

type State = { error?: string; success?: boolean } | undefined;

export async function updatePricingPolicy(
  _: State,
  formData: FormData
): Promise<State> {
  // Authorization before validation — consistent with changeMemberRole / deactivateMember
  const { school, membership } = await getTenantContext();

  if (!["owner", "admin"].includes(membership.role)) {
    return { error: "Unauthorized" };
  }

  const parsed = PricingSchema.safeParse({
    parentFeeBps: formData.get("parentFeeBps"),
    feeDisplayMode: formData.get("feeDisplayMode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation error" };
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

  if (error) return { error: "Failed to update pricing policy." };

  revalidatePath("/dashboard/settings");
  return { success: true };
}
