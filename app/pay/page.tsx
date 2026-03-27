import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function PayIndex() {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold mb-2">{copy.help.title}</h1>
        <p className="text-gray-500">
          {copy.help.description}
        </p>
      </div>
    </main>
  );
}
