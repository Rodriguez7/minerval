import type { Metadata } from "next";
import { LegalPage } from "@/app/legal/LegalPage";
import { getRequestLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Refunds and Cancellations | Minerval",
  description: "Minerval cancellation, refund, and payment dispute process.",
};

export default async function RefundsPage() {
  return <LegalPage locale={await getRequestLocale()} kind="refunds" />;
}
