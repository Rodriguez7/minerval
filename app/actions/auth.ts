"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSSRClient } from "@/lib/supabase";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation error";
    return { error: msg };
  }

  const { email, password } = parsed.data;
  const supabase = await createSSRClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError || !authData.user) return { error: authError?.message ?? "Signup failed." };

  redirect("/onboarding/school");
}
