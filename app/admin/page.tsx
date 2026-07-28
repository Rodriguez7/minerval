import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { getRequestLocale } from "@/lib/i18n/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const admin = getAdminClient();
  const [
    { count: totalSchools },
    { count: pendingSchools },
    { count: correctionSchools },
    { count: pendingPayouts },
    { count: processingPayouts },
  ] = await Promise.all([
    admin.from("schools").select("id", { count: "exact", head: true }),
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "rejected"),
    admin
      .from("school_payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("school_payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
  ]);

  const workItems = [
    {
      href: "/admin/schools?status=pending",
      count: pendingSchools ?? 0,
      title: fr ? "Dossiers à examiner" : "Applications to review",
      description: fr
        ? "Informations légales et documents envoyés par les établissements."
        : "Legal information and documents submitted by schools.",
      action: fr ? "Examiner les dossiers" : "Review applications",
    },
    {
      href: "/admin/payouts",
      count: pendingPayouts ?? 0,
      title: fr ? "Versements à approuver" : "Payouts to approve",
      description: fr
        ? "Demandes de retrait prêtes pour la vérification finale."
        : "Withdrawal requests ready for final review.",
      action: fr ? "Examiner les versements" : "Review payouts",
    },
  ];

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {fr ? "Minerval Admin" : "Minerval Admin"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "À traiter aujourd’hui" : "Today’s work queue"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fr
            ? "Une vue simple des décisions qui nécessitent votre attention."
            : "A simple view of decisions that need your attention."}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={fr ? "Résumé" : "Summary"}>
        {[
          [fr ? "Établissements" : "Schools", totalSchools ?? 0],
          [fr ? "À vérifier" : "To verify", pendingSchools ?? 0],
          [fr ? "À corriger" : "Needs changes", correctionSchools ?? 0],
          [fr ? "Versements en cours" : "Payouts processing", processingPayouts ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {workItems.map((item) => (
          <article key={item.href} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tracking-tight text-zinc-950">{item.count}</p>
                <h2 className="mt-3 font-semibold text-zinc-950">{item.title}</h2>
              </div>
              {item.count > 0 && (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{item.description}</p>
            <LocalizedLink
              href={item.href}
              className="mt-5 inline-flex rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-zinc-800"
            >
              {item.action}
            </LocalizedLink>
          </article>
        ))}
      </section>

      <p className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm leading-6 text-zinc-600">
        {fr
          ? "Les versements déplacent de l’argent réel. Confirmez toujours l’établissement, la devise, le montant net, le numéro Mobile Money et l’opérateur."
          : "Payouts move real money. Always confirm the school, currency, net amount, Mobile Money number, and provider."}
      </p>
    </div>
  );
}
