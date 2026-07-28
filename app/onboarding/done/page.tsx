import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/server";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";
import { localizePathname } from "@/lib/i18n/config";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { getVerificationDocuments } from "@/lib/verification-documents";
import { VerificationDocumentsForm } from "@/app/dashboard/settings/VerificationDocumentsForm";

export default async function OnboardingDonePage() {
  const locale = await getRequestLocale();
  const copy = getOnboardingCopy(locale);
  const { school, membership } = await getTenantContext();
  const documents = await getVerificationDocuments(getAdminClient(), school.id);
  const fr = locale === "fr";

  return (
    <div className="space-y-6 rounded-xl bg-white p-6 shadow sm:p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{copy.done.title}</h1>
        <p className="text-gray-500 mt-2 text-sm">
          {copy.done.description}
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 p-5">
        <p className="text-sm font-semibold text-zinc-950">
          {fr ? "Vérifiez votre établissement" : "Verify your school"}
        </p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          {fr
            ? "Ajoutez maintenant vos documents officiels, ou faites-le plus tard avant votre première demande de versement."
            : "Upload your official documents now, or do it later before your first payout request."}
        </p>
        <VerificationDocumentsForm
          documents={documents}
          canManage={["owner", "admin"].includes(membership.role)}
          locale={locale}
        />
      </div>
      <Link
        href={localizePathname(locale, "/dashboard")}
        className="block rounded-lg bg-blue-600 px-6 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        {copy.done.cta}
      </Link>
    </div>
  );
}
