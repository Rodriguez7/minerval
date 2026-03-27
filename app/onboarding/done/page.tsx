import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { localizePathname } from "@/lib/i18n/config";

export default async function OnboardingDonePage() {
  const locale = await getRequestLocale();
  const copy = getOnboardingCopy(locale);

  return (
    <div className="bg-white rounded-xl shadow p-8 text-center space-y-6">
      <div className="text-5xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold">{copy.done.title}</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {copy.done.description}
        </p>
      </div>
      <Link
        href={localizePathname(locale, "/dashboard")}
        className="inline-block bg-blue-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        {copy.done.cta}
      </Link>
    </div>
  );
}
