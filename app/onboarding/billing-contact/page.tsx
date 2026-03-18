import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { BillingContactForm } from "./BillingContactForm";

export default async function OnboardingBillingContactPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // No membership yet → back to school setup
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/onboarding/school");

  return <BillingContactForm defaultEmail={user.email ?? undefined} />;
}
