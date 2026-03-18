"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const SignupSchema = z.object({
  schoolName: z.string().min(2).max(200),
  schoolCode: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only").min(2).max(30),
  studentIdPrefix: z.string().regex(/^[A-Z0-9]{2,6}$/, "2–6 uppercase letters/numbers (e.g. ESM)"),
  currency: z.enum(["FC", "USD"]),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(_: unknown, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password format." };

  const supabase = await createSSRClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password." };

  redirect("/dashboard");
}

export async function resetPassword(_: unknown, formData: FormData) {
  const email = formData.get("email");
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { error: "Please enter a valid email address." };

  const supabase = await createSSRClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) return { error: "Failed to send reset email. Please try again." };
  return { success: true };
}

export async function logout() {
  const supabase = await createSSRClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signup(_: unknown, formData: FormData) {
  const parsed = SignupSchema.safeParse({
    schoolName: formData.get("schoolName"),
    schoolCode: formData.get("schoolCode"),
    studentIdPrefix: formData.get("studentIdPrefix"),
    currency: formData.get("currency"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation error";
    return { error: msg };
  }

  const { schoolName, schoolCode, studentIdPrefix, currency, email, password } = parsed.data;

  const { data: existing } = await getAdminClient()
    .from("schools").select("id").eq("code", schoolCode).single();
  if (existing) return { error: "School code already taken." };

  const supabase = await createSSRClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError || !authData.user) return { error: authError?.message ?? "Signup failed." };

  const admin = getAdminClient();

  const { data: newSchool, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: schoolName,
      code: schoolCode,
      admin_email: email,
      student_id_prefix: studentIdPrefix,
      currency,
    })
    .select("id")
    .single();

  if (schoolError || !newSchool) return { error: "Failed to create school." };

  await admin.from("school_memberships").insert({
    user_id: authData.user.id,
    school_id: newSchool.id,
    role: "owner",
    status: "active",
  });

  await admin.from("school_subscriptions").insert({
    school_id: newSchool.id,
    plan_code: "starter_free",
    status: "active",
    billing_exempt: false,
  });

  await admin.from("school_pricing_policies").insert({
    school_id: newSchool.id,
    parent_fee_bps: 275,
    fee_display_mode: "visible_line_item",
    active: true,
  });

  redirect("/dashboard");
}
