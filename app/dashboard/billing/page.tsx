import { getTenantContext } from "@/lib/tenant";
import { createCheckoutSession, createPortalSession } from "@/app/actions/billing";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { plan, subscription } = await getTenantContext();

  const statusBadge: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    trialing: "bg-blue-50 text-blue-700 border border-blue-200",
    past_due: "bg-orange-50 text-orange-700 border border-orange-200",
    canceled: "bg-red-50 text-red-700 border border-red-200",
  };

  const statusLabels: Record<string, string> = {
    active: "Actif",
    trialing: "Essai",
    past_due: "Impayes",
    canceled: "Annule",
  };

  const entitlements = [
    { label: "Recus personnalises", enabled: plan.can_branded_receipts },
    { label: "Rapports avances", enabled: plan.can_rich_reports },
    { label: "Operations en masse", enabled: plan.can_bulk_ops },
    { label: "Export comptable", enabled: plan.can_accounting_export },
    { label: "Analytique avancee", enabled: plan.can_advanced_analytics },
    {
      label: `Eleves : ${plan.max_students === null ? "Illimites" : `Jusqu'a ${plan.max_students}`}`,
      enabled: true,
    },
  ];

  const isOnFreePlan = plan.monthly_price_usd === 0 && !subscription.billing_exempt;
  const hasStripeCustomer = !!subscription.stripe_customer_id;
  const isTrialing = subscription.status === "trialing";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Facturation</h1>
        <p className="text-sm text-zinc-500 mt-1">Gerez votre plan et votre abonnement</p>
      </div>

      {(await searchParams).expired === "1" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm font-medium">
            Votre abonnement a expire. Mettez a jour votre moyen de paiement pour retablir l&apos;acces.
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Plan actuel</p>
            <p className="text-xl font-bold text-zinc-950 mt-1">{plan.name}</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              {plan.monthly_price_usd === 0 ? "Gratuit" : `$${plan.monthly_price_usd} / mois`}
            </p>
            {subscription.billing_exempt && (
              <p className="text-xs text-zinc-400 mt-1">Exonere de facturation (compte historique)</p>
            )}
            {subscription.status === "trialing" && subscription.trial_ends_at && (
              <p className="text-sm text-blue-600 mt-1">
                L&apos;essai se termine le {new Date(subscription.trial_ends_at).toLocaleDateString("fr-FR")}
              </p>
            )}
            {subscription.status === "past_due" && (
              <p className="text-sm text-orange-600 mt-1">
                Veuillez mettre a jour votre moyen de paiement.
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              statusBadge[subscription.status] ?? "bg-zinc-100 text-zinc-500 border border-zinc-200"
            }`}
          >
            {statusLabels[subscription.status] ?? subscription.status}
          </span>
        </div>
      </div>

      {/* Trial banner */}
      {isTrialing && subscription.trial_ends_at && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900 text-sm">
              Essai actif jusqu&apos;au {new Date(subscription.trial_ends_at).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              Ajoutez un moyen de paiement pour continuer apres la fin de l&apos;essai.
            </p>
          </div>
          {hasStripeCustomer && (
            <form action={async () => { "use server"; await createPortalSession(); }}>
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
              >
                Ajouter un moyen de paiement
              </button>
            </form>
          )}
        </div>
      )}

      {/* Features */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Fonctionnalites</h2>
        <ul className="space-y-2.5">
          {entitlements.map((e) => (
            <li key={e.label} className="flex items-center gap-3 text-sm">
              <span className={`text-sm font-bold ${e.enabled ? "text-emerald-600" : "text-zinc-300"}`}>
                {e.enabled ? "✓" : "—"}
              </span>
              <span className={e.enabled ? "text-zinc-900" : "text-zinc-400"}>{e.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Manage billing */}
      {hasStripeCustomer && !isTrialing && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">Gerer votre abonnement</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              Mettez a jour le moyen de paiement, telechargez les factures ou annulez
            </p>
          </div>
          <form action={async () => { "use server"; await createPortalSession(); }}>
            <button
              type="submit"
              className="border border-zinc-200 rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
            >
              Portail de facturation →
            </button>
          </form>
        </div>
      )}

      {/* Upgrade CTA */}
      {isOnFreePlan && !hasStripeCustomer && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Changer de plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Growth */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
              <div>
                <p className="font-bold text-zinc-950">Growth</p>
                <p className="text-sm text-zinc-500">$29 / mois</p>
                <p className="text-xs text-blue-600 font-medium mt-1">Essai gratuit de 14 jours</p>
              </div>
              <ul className="text-sm space-y-1.5 text-zinc-600">
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Recus personnalises</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Rapports avances</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Eleves illimites</li>
              </ul>
              <form action={async () => { "use server"; await createCheckoutSession("growth_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                  Demarrer l&apos;essai de 14 jours
                </button>
              </form>
            </div>

            {/* Pro */}
            <div className="bg-white rounded-xl border-2 border-zinc-900 p-6 space-y-4">
              <div>
                <p className="font-bold text-zinc-950">Pro</p>
                <p className="text-sm text-zinc-500">$99 / mois</p>
                <p className="text-xs text-blue-600 font-medium mt-1">Essai gratuit de 14 jours</p>
              </div>
              <ul className="text-sm space-y-1.5 text-zinc-600">
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Tout le contenu de Growth</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Operations en masse</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Export comptable</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> Analytique avancee</li>
              </ul>
              <form action={async () => { "use server"; await createCheckoutSession("pro_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                  Demarrer l&apos;essai de 14 jours
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Legacy */}
      {subscription.billing_exempt && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 text-center">
          <p className="text-zinc-500 text-sm">
            Vous etes sur un plan historique. Contactez{" "}
            <a href="mailto:support@minerval.app" className="text-blue-600 hover:underline">
              support@minerval.app
            </a>{" "}
            pour discuter des options de mise a niveau.
          </p>
        </div>
      )}
    </div>
  );
}
