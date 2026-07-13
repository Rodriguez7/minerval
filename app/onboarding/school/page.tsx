import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { SchoolForm } from "./SchoolForm";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function OnboardingSchoolPage() {
  const locale = await getRequestLocale();
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localizePathname(locale, "/login"));

  // If user already has an active membership, school setup is done — advance
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership) redirect(localizePathname(locale, "/onboarding/billing-contact"));

  return <SchoolForm />;
}
