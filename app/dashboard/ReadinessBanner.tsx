import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import type { AppLocale } from "@/lib/i18n/config";
import type { SchoolVerificationStatus } from "@/lib/types";

export function ReadinessBanner({
  locale,
  verificationStatus,
}: {
  locale: AppLocale;
  verificationStatus: SchoolVerificationStatus;
}) {
  if (verificationStatus === "verified") return null;
  const fr = locale === "fr";
  const pending = verificationStatus === "pending";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 md:px-8">
      <div className="flex max-w-6xl flex-col gap-2 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong>{fr ? "Rappels WhatsApp bloqués." : "WhatsApp reminders are blocked."}</strong>{" "}
          {pending
            ? fr
              ? "La vérification interne de l’établissement est en cours."
              : "The school’s internal verification is under review."
            : fr
              ? "Complétez et soumettez le profil légal de l’établissement."
              : "Complete and submit the school’s legal profile."}
        </p>
        <LocalizedLink
          href="/dashboard/settings#verification"
          className="shrink-0 font-semibold underline underline-offset-2"
        >
          {fr ? "Ouvrir la vérification" : "Open verification"}
        </LocalizedLink>
      </div>
    </div>
  );
}
