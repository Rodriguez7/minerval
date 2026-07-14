import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Privacy Policy | Minerval",
  description: "Minerval privacy and personal data policy.",
};

export default async function PrivacyPage() {
  return <LegalPage locale={await getRequestLocale()} kind="privacy" />;
}
