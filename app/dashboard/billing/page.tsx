import { getTenantContext } from "@/lib/tenant";
import { createCheckoutSession, createPortalSession } from "@/app/actions/billing";
import { getLegalOperator } from "@/lib/legal";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const { plan, subscription } = await getTenantContext();
  const supportEmail = getLegalOperator().contactEmail;

  const statusBadge: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    trialing: "bg-blue-50 text-blue-700 border border-blue-200",
    past_due: "bg-orange-50 text-orange-700 border border-orange-200",
    canceled: "bg-red-50 text-red-700 border border-red-200",
  };

  const statusLabels: Record<string, string> = {
    active: fr ? "Actif" : "Active",
    trialing: fr ? "Essai" : "Trial",
    past_due: fr ? "Impayé" : "Past due",
    canceled: fr ? "Annulé" : "Canceled",
  };

  const entitlements = [
    { label: fr ? "Reçus personnalisés" : "Branded receipts", enabled: plan.can_branded_receipts },
    { label: fr ? "Rapports avancés" : "Advanced reports", enabled: plan.can_rich_reports },
    { label: fr ? "Opérations en masse" : "Bulk operations", enabled: plan.can_bulk_ops },
    { label: fr ? "Export comptable" : "Accounting export", enabled: plan.can_accounting_export },
    { label: fr ? "Analytique avancée" : "Advanced analytics", enabled: plan.can_advanced_analytics },
    {
      label: fr
        ? `Élèves : ${plan.max_students === null ? "Illimités" : `Jusqu’à ${plan.max_students}`}`
        : `Students: ${plan.max_students === null ? "Unlimited" : `Up to ${plan.max_students}`}`,
      enabled: true,
    },
  ];

  const isOnFreePlan = plan.monthly_price_usd === 0 && !subscription.billing_exempt;
  const hasStripeCustomer = !!subscription.stripe_customer_id;
  const isTrialing = subscription.status === "trialing";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Facturation" : "Billing"}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Gérez votre plan et votre abonnement" : "Manage your plan and subscription"}
        </p>
      </div>

      {(await searchParams).expired === "1" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm font-medium">
            {fr
              ? "Votre abonnement a expiré. Mettez à jour votre moyen de paiement pour rétablir l’accès."
              : "Your subscription has expired. Update your payment method to restore access."}
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Plan actuel" : "Current plan"}
            </p>
            <p className="text-xl font-bold text-zinc-950 mt-1">{plan.name}</p>
            <p className="text-sm text-zinc-500 mt-0.5">
              {plan.monthly_price_usd === 0
                ? fr ? "Gratuit" : "Free"
                : `$${plan.monthly_price_usd} / ${fr ? "mois" : "month"}`}
            </p>
            {subscription.billing_exempt && (
              <p className="text-xs text-zinc-400 mt-1">
                {fr ? "Exonéré de facturation (compte historique)" : "Billing exempt (legacy account)"}
              </p>
            )}
            {subscription.status === "trialing" && subscription.trial_ends_at && (
              <p className="text-sm text-blue-600 mt-1">
                {fr ? "L’essai se termine le" : "Trial ends on"}{" "}
                {new Date(subscription.trial_ends_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}
              </p>
            )}
            {subscription.status === "past_due" && (
              <p className="text-sm text-orange-600 mt-1">
                {fr ? "Veuillez mettre à jour votre moyen de paiement." : "Please update your payment method."}
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
              {fr ? "Essai actif jusqu’au" : "Trial active until"}{" "}
              {new Date(subscription.trial_ends_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              {fr ? "Ajoutez un moyen de paiement pour continuer après la fin de l’essai." : "Add a payment method to continue after the trial."}
            </p>
          </div>
          {hasStripeCustomer && (
            <form action={async () => { "use server"; await createPortalSession(); }}>
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
              >
                {fr ? "Ajouter un moyen de paiement" : "Add payment method"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Features */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">
          {fr ? "Fonctionnalités" : "Features"}
        </h2>
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
            <p className="text-sm font-medium text-zinc-900">
              {fr ? "Gérer votre abonnement" : "Manage subscription"}
            </p>
            <p className="text-sm text-zinc-500 mt-0.5">
              {fr ? "Mettez à jour le moyen de paiement, téléchargez les factures ou annulez." : "Update the payment method, download invoices, or cancel."}
            </p>
          </div>
          <form action={async () => { "use server"; await createPortalSession(); }}>
            <button
              type="submit"
              className="border border-zinc-200 rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all"
            >
              {fr ? "Portail de facturation →" : "Billing portal →"}
            </button>
          </form>
        </div>
      )}

      {/* Upgrade CTA */}
      {isOnFreePlan && !hasStripeCustomer && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Changer de plan" : "Change plan"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Growth */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
              <div>
                <p className="font-bold text-zinc-950">Growth</p>
                <p className="text-sm text-zinc-500">$29 / {fr ? "mois" : "month"}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">
                  {fr ? "Essai gratuit de 14 jours" : "14-day free trial"}
                </p>
              </div>
              <ul className="text-sm space-y-1.5 text-zinc-600">
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Reçus personnalisés" : "Branded receipts"}</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Rapports avancés" : "Advanced reports"}</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Élèves illimités" : "Unlimited students"}</li>
              </ul>
              <form action={async () => { "use server"; await createCheckoutSession("growth_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                  {fr ? "Démarrer l’essai de 14 jours" : "Start 14-day trial"}
                </button>
              </form>
            </div>

            {/* Pro */}
            <div className="bg-white rounded-xl border-2 border-zinc-900 p-6 space-y-4">
              <div>
                <p className="font-bold text-zinc-950">Pro</p>
                <p className="text-sm text-zinc-500">$99 / {fr ? "mois" : "month"}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">
                  {fr ? "Essai gratuit de 14 jours" : "14-day free trial"}
                </p>
              </div>
              <ul className="text-sm space-y-1.5 text-zinc-600">
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Tout le contenu de Growth" : "Everything in Growth"}</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Opérations en masse" : "Bulk operations"}</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Export comptable" : "Accounting export"}</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span> {fr ? "Analytique avancée" : "Advanced analytics"}</li>
              </ul>
              <form action={async () => { "use server"; await createCheckoutSession("pro_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
                >
                  {fr ? "Démarrer l’essai de 14 jours" : "Start 14-day trial"}
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
            {fr ? "Vous êtes sur un plan historique. Contactez " : "You are on a legacy plan. Contact "}
            <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
              {supportEmail}
            </a>{" "}
            {fr ? " pour discuter des options de mise à niveau." : " to discuss upgrade options."}
          </p>
        </div>
      )}
    </div>
  );
}
