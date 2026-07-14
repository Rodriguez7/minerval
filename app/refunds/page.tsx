import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { getLegalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const document = getLegalDocument(locale, "refunds");
  return {
    title: `${document.title} | Minerval`,
    description: document.description,
    alternates: {
      canonical: localizePathname(locale, "/refunds"),
      languages: { fr: "/fr/refunds", en: "/en/refunds" },
    },
  };
}

export default async function RefundsPage() {
  return <LegalPage locale={await getRequestLocale()} kind="refunds" />;
}
