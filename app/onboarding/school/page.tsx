import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { SchoolForm } from "./SchoolForm";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";

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

  return (
    <div className="space-y-4">
      <div className="text-right">
        <LocalizedLink href="/account" className="text-sm text-zinc-600 hover:underline">
          {locale === "fr" ? "Gerer mon compte personnel" : "Manage my personal account"}
        </LocalizedLink>
      </div>
      <SchoolForm />
    </div>
  );
}
