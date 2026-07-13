import { CsvImportForm } from "@/app/dashboard/students/CsvImportForm";
import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { localizePathname } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenant";

export default async function OnboardingImportPage() {
  const locale = await getRequestLocale();
  const copy = getOnboardingCopy(locale);
  const { school } = await getTenantContext();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow px-8 pt-6 pb-2">
        <p className="text-sm text-blue-600 font-medium">{copy.import.step}</p>
        <h1 className="text-2xl font-bold mt-1">{copy.import.title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          {copy.import.description}
        </p>
      </div>
      <CsvImportForm educationLevels={school.education_levels} />
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
