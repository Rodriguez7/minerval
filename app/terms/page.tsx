import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Terms of Use | Minerval",
  description: "Terms applying to Minerval accounts, payments, and payouts.",
};

export default async function TermsPage() {
  return <LegalPage locale={await getRequestLocale()} kind="terms" />;
}
