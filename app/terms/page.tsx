import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { getLegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const document = getLegalDocument(locale, "terms");
  return {
    title: `${document.title} | Minerval`,
    description: document.description,
    alternates: {
      canonical: localizePathname(locale, "/terms"),
      languages: { fr: "/fr/terms", en: "/en/terms" },
    },
  };
}

export default async function TermsPage() {
  return <LegalPage locale={await getRequestLocale()} kind="terms" />;
}
