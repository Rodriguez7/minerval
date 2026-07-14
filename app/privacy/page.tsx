import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { getLegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const document = getLegalDocument(locale, "privacy");
  return {
    title: `${document.title} | Minerval`,
    description: document.description,
    alternates: {
      canonical: localizePathname(locale, "/privacy"),
      languages: { fr: "/fr/privacy", en: "/en/privacy" },
    },
  };
}

export default async function PrivacyPage() {
  return <LegalPage locale={await getRequestLocale()} kind="privacy" />;
}
