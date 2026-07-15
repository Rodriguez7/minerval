import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { MfaSetup } from "./MfaSetup";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const locale = await getRequestLocale();
  const french = locale === "fr";
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localizePathname(locale, "/login"));

  const [{ data: factors }, { data: assurance }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const factor = factors?.totp.find((item) => item.status === "verified");

  return (
    <main className="relative min-h-screen bg-zinc-50 px-4 py-16">
      <div className="absolute right-4 top-4 md:right-6 md:top-6"><LanguageSwitcher /></div>
      <div className="mx-auto max-w-xl">
        <LocalizedLink href="/account" className="text-sm text-zinc-600 hover:underline">
          {french ? "Retour au compte" : "Back to account"}
        </LocalizedLink>
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-950">
            {french ? "Authentification a deux facteurs" : "Two-factor authentication"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {french ? "Protegez les paiements et les donnees scolaires avec un code genere sur votre telephone." : "Protect payments and school data with a code generated on your phone."}
          </p>
          <div className="mt-6">
            <MfaSetup locale={locale} factorId={factor?.id} currentLevel={assurance?.currentLevel ?? null} />
          </div>
        </section>
      </div>
    </main>
  );
}
