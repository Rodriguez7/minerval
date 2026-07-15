import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { getSafeAuthNext } from "@/lib/auth-redirect";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { MfaChallengeForm } from "./MfaChallengeForm";

export const dynamic = "force-dynamic";

export default async function MfaVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getRequestLocale();
  const french = locale === "fr";
  const next = getSafeAuthNext((await searchParams).next, locale);
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localizePathname(locale, "/login"));

  const [{ data: factors }, { data: assurance }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (assurance?.currentLevel === "aal2") redirect(next);
  const factor = factors?.totp.find((item) => item.status === "verified");
  if (!factor) redirect(next);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="absolute right-4 top-4 md:right-6 md:top-6"><LanguageSwitcher /></div>
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Minerval Security</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-950">{french ? "Verification en deux etapes" : "Two-step verification"}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{french ? "Ouvrez votre application d'authentification et saisissez le code actuel." : "Open your authenticator app and enter the current code."}</p>
        <MfaChallengeForm factorId={factor.id} locale={locale} next={next} />
      </section>
    </main>
  );
}
