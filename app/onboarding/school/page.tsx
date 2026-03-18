import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { SchoolForm } from "./SchoolForm";

export default async function OnboardingSchoolPage() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If user already has an active membership, school setup is done — advance
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (membership) redirect("/onboarding/billing-contact");

  return <SchoolForm />;
}
