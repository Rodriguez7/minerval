import { redirect } from "next/navigation";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { localizePathname } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();

  if (
    !user ||
    !process.env.SUPER_ADMIN_EMAIL ||
    user.email !== process.env.SUPER_ADMIN_EMAIL
  ) {
    redirect(localizePathname(locale, "/dashboard"));
  }

  const admin = getAdminClient();
  const [{ count: pendingSchools }, { count: pendingPayouts }] = await Promise.all([
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    admin
      .from("school_payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const fr = locale === "fr";
  const sections = [
    {
      href: "/dashboard/admin/schools",
      title: fr ? "Vérification des établissements" : "School verification",
      description: fr
        ? "Examinez les informations légales et approuvez ou refusez les demandes d’activation."
        : "Review legal information and approve or reject activation requests.",
      count: pendingSchools ?? 0,
      countLabel: fr ? "en attente" : "pending",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M6 21V7l6-4 6 4v14" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
          <path d="M9 18h6" />
        </svg>
      ),
    },
    {
      href: "/dashboard/admin/payouts",
      title: fr ? "Approbation des versements" : "Payout approval",
      description: fr
        ? "Vérifiez les demandes de retrait des écoles avant leur envoi à SerdiPay."
        : "Review school withdrawal requests before they are submitted to SerdiPay.",
      count: pendingPayouts ?? 0,
      countLabel: fr ? "en attente" : "pending",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M16 15h2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {fr ? "Accès interne protégé" : "Protected internal access"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Administration Minerval" : "Minerval administration"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
          {fr
            ? "Cette section est réservée au super-administrateur et n’apparaît jamais dans l’interface des écoles."
            : "This area is restricted to the super administrator and never appears in the school interface."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <LocalizedLink
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-6 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                {section.icon}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {section.count} {section.countLabel}
              </span>
            </div>
            <h2 className="mt-5 text-base font-semibold text-zinc-950 group-hover:text-blue-700">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {section.description}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
              {fr ? "Ouvrir" : "Open"}
              <span aria-hidden="true">→</span>
            </span>
          </LocalizedLink>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        {fr
          ? "Les approbations de versement déclenchent une opération financière réelle. Vérifiez toujours l’école, la devise, le numéro et l’opérateur avant de confirmer."
          : "Approving a payout triggers a real financial operation. Always verify the school, currency, phone number, and provider before confirming."}
      </div>
    </div>
  );
}
