import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { BillingContactForm } from "./BillingContactForm";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function OnboardingBillingContactPage() {
  const locale = await getRequestLocale();
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localizePathname(locale, "/login"));

  // No membership yet → back to school setup
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect(localizePathname(locale, "/onboarding/school"));

  return <BillingContactForm defaultEmail={user.email ?? undefined} />;
}
