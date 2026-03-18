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

  await getAdminClient().from("schools").insert({
    name: schoolName,
    code: schoolCode,
    admin_email: email,
    student_id_prefix: studentIdPrefix,
    currency,
  });

  redirect("/dashboard");
}
