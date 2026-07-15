import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizePathname } from "@/lib/i18n/config";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const locale = await getRequestLocale();
  const french = locale === "fr";
  const authenticated = await createSSRClient();
  const { data: { user } } = await authenticated.auth.getUser();
  if (!user?.email) redirect(localizePathname(locale, "/login"));

  return (
    <main className="relative min-h-screen bg-zinc-50 px-4 py-16">
      <div className="absolute right-4 top-4 md:right-6 md:top-6"><LanguageSwitcher /></div>
      <div className="mx-auto max-w-xl">
        <LocalizedLink href="/dashboard/settings" className="text-sm text-zinc-600 hover:underline">
          {french ? "Retour aux parametres" : "Back to settings"}
        </LocalizedLink>
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-950">
            {french ? "Securite du compte" : "Account security"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {french
              ? "Ajoutez une application d'authentification pour proteger les donnees et les operations financieres de votre ecole."
              : "Add an authenticator app to protect your school's data and financial operations."}
          </p>
          <LocalizedLink href="/account/security" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {french ? "Configurer le MFA" : "Configure MFA"}
          </LocalizedLink>
        </section>
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-950">
            {french ? "Supprimer mon compte personnel" : "Delete my personal account"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-red-900">
            {french
              ? "Cette suppression est irreversible. Elle supprime votre connexion et vos acces. Les paiements, versements et journaux requis restent conserves, sans reference active vers votre identite."
              : "This deletion is irreversible. It removes your login and access. Required payment, payout, and audit records remain retained without an active reference to your identity."}
          </p>
          <p className="mt-2 text-sm font-medium text-red-950">
            {french
              ? "Si vous possedez une ecole active, transferez sa propriete ou fermez-la d'abord."
              : "If you own an active school, transfer ownership or close it first."}
          </p>
          <DeleteAccountForm email={user.email} locale={locale} />
        </section>
      </div>
    </main>
  );
}
