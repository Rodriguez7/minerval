import Link from "next/link";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

type Props = {
  title?: string;
  description?: string;
};

export async function InactivePaymentLink({
  title,
  description,
}: Props) {
  const locale = await getRequestLocale();
  const copy = getPaymentsCopy(locale);

  return (
    <main className="relative min-h-screen bg-gray-50 px-4 flex items-center justify-center">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xl font-semibold">
          !
        </div>
        <h1 className="text-2xl font-bold mb-3">{title ?? copy.inactive.title}</h1>
        <p className="text-sm leading-6 text-gray-600">
          {description ?? copy.inactive.description}
        </p>
        <div className="mt-6">
          <Link
            href={localizePathname(locale, "/pay")}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {copy.inactive.cta}
          </Link>
        </div>
      </div>
    </main>
  );
}
