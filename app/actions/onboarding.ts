"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

const SchoolSchema = z.object({
  schoolName: z.string().min(2).max(200),
  schoolCode: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only")
    .min(2)
    .max(30),
  studentIdPrefix: z
    .string()
    .regex(/^[A-Z0-9]{2,6}$/, "2–6 uppercase letters/numbers (e.g. ESM)"),
  currency: z.enum(["FC", "USD"]),
});

export async function createSchool(_: unknown, formData: FormData) {
  const parsed = SchoolSchema.safeParse({
    schoolName: formData.get("schoolName"),
    schoolCode: formData.get("schoolCode"),
    studentIdPrefix: formData.get("studentIdPrefix"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation error";
    return { error: msg };
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("schools")
    .select("id")
    .eq("code", parsed.data.schoolCode)
    .maybeSingle();
  if (lookupError) return { error: "Failed to check school code availability." };
  if (existing) return { error: "School code already taken." };

  const { data: newSchool, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: parsed.data.schoolName,
      code: parsed.data.schoolCode,
      admin_email: user.email!,
      student_id_prefix: parsed.data.studentIdPrefix,
      currency: parsed.data.currency,
    })
    .select("id")
    .single();

  if (schoolError || !newSchool) return { error: "Failed to create school." };

  const { error: membershipError } = await admin.from("school_memberships").insert({
    user_id: user.id,
    school_id: newSchool.id,
    role: "owner",
    status: "active",
  });
  if (membershipError) return { error: "Failed to complete school setup." };

  const { error: subscriptionError } = await admin.from("school_subscriptions").insert({
    school_id: newSchool.id,
    plan_code: "starter_free",
    status: "active",
    billing_exempt: false,
  });
  if (subscriptionError) return { error: "Failed to complete school setup." };

  const { error: pricingError } = await admin.from("school_pricing_policies").insert({
    school_id: newSchool.id,
    parent_fee_bps: 275,
    fee_display_mode: "visible_line_item",
    active: true,
  });
  if (pricingError) return { error: "Failed to complete school setup." };

  redirect("/onboarding/billing-contact");
}

const BillingContactSchema = z.object({
  billingEmail: z.string().email(),
  billingContact: z.string().min(2).max(200),
  timezone: z.string().min(1),
});

export async function updateBillingContact(_: unknown, formData: FormData) {
  const parsed = BillingContactSchema.safeParse({
    billingEmail: formData.get("billingEmail"),
    billingContact: formData.get("billingContact"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation error";
    return { error: msg };
  }

  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get the user's school via membership (SSR client — RLS enforced)
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("school_id")
    .eq("status", "active")
    .single();

  if (!membership) redirect("/onboarding/school");

  const { error } = await supabase
    .from("schools")
    .update({
      billing_email: parsed.data.billingEmail,
      billing_contact: parsed.data.billingContact,
      timezone: parsed.data.timezone,
    })
    .eq("id", membership.school_id);

  if (error) return { error: "Failed to update billing contact." };

  redirect("/onboarding/import");
}
