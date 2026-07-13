import { redirect } from "next/navigation";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{copy.receipt.missingReference}</p>
      </main>
    );
  }

  redirect(localizeHref(locale, `/pay/receipt?token=${encodeURIComponent(token)}`));
}
