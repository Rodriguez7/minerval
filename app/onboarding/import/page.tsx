import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { CsvImportForm } from "@/app/dashboard/students/CsvImportForm";
import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { localizePathname } from "@/lib/i18n/config";

export default async function OnboardingImportPage() {
  const locale = await getRequestLocale();
  const copy = getOnboardingCopy(locale);
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("school_memberships")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (!membership) redirect("/onboarding/school");

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow px-8 pt-6 pb-2">
        <p className="text-sm text-blue-600 font-medium">{copy.import.step}</p>
        <h1 className="text-2xl font-bold mt-1">{copy.import.title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          {copy.import.description}
        </p>
      </div>
      <CsvImportForm />
      <div className="flex justify-end">
        <Link
          href={localizePathname(locale, "/onboarding/done")}
          className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          {copy.import.skip}
        </Link>
      </div>
    </div>
  );
}
