import { getTenantContext } from "@/lib/tenant";
import { createCheckoutSession, createPortalSession } from "@/app/actions/billing";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { plan, subscription } = await getTenantContext();

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-orange-100 text-orange-700",
    canceled: "bg-red-100 text-red-700",
  };

  const statusLabels: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceled: "Canceled",
  };

  const entitlements = [
    { label: "Branded receipts", enabled: plan.can_branded_receipts },
    { label: "Rich reports", enabled: plan.can_rich_reports },
    { label: "Bulk operations", enabled: plan.can_bulk_ops },
    { label: "Accounting export", enabled: plan.can_accounting_export },
    { label: "Advanced analytics", enabled: plan.can_advanced_analytics },
  ];

  const isOnFreePlan = plan.monthly_price_usd === 0 && !subscription.billing_exempt;
  const hasStripeCustomer = !!subscription.stripe_customer_id;
  const isTrialing = subscription.status === "trialing";

  let trialDaysRemaining: number | null = null;
  if (isTrialing && subscription.trial_ends_at) {
    const ms = new Date(subscription.trial_ends_at).getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {(await searchParams).expired === "1" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm font-medium">
            Your subscription has expired. Please update your payment method to restore access.
          </p>
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold">{plan.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {plan.monthly_price_usd === 0
                ? "Free"
                : `$${plan.monthly_price_usd} / month`}
            </p>
            {subscription.billing_exempt && (
              <p className="text-xs text-gray-400 mt-1">
                Billing exempt (legacy account)
              </p>
            )}
            {subscription.status === "trialing" && subscription.trial_ends_at && (
              <p className="text-sm text-blue-600 mt-1">
                Trial ends{" "}
                {new Date(subscription.trial_ends_at).toLocaleDateString()}
              </p>
            )}
            {subscription.status === "past_due" && (
              <p className="text-sm text-orange-600 mt-1">
                Please update your payment method.
              </p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              statusColors[subscription.status] ?? "bg-gray-100 text-gray-500"
            }`}
          >
            {statusLabels[subscription.status] ?? subscription.status}
          </span>
        </div>
      </div>

      {/* Trial banner */}
      {isTrialing && trialDaysRemaining !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900">
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left in your trial
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              Add a payment method to continue after the trial ends.
            </p>
          </div>
          {hasStripeCustomer && (
            <form action={async () => { await createPortalSession(); }}>
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Add payment method
              </button>
            </form>
          )}
        </div>
      )}

      {/* Entitlements */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-4">Features</h2>
        <ul className="space-y-2">
          {entitlements.map((e) => (
            <li key={e.label} className="flex items-center gap-3 text-sm">
              {e.enabled ? (
                <span className="text-green-600 font-bold">&#10003;</span>
              ) : (
                <span className="text-gray-300 font-bold">&mdash;</span>
              )}
              <span className={e.enabled ? "text-gray-900" : "text-gray-400"}>
                {e.label}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">&#10003;</span>
            <span className="text-gray-900">
              Students:{" "}
              {plan.max_students === null ? "Unlimited" : `Up to ${plan.max_students}`}
            </span>
          </li>
        </ul>
      </div>

      {/* Manage billing (for paying customers not in trial) */}
      {hasStripeCustomer && !isTrialing && (
        <div className="bg-white rounded-xl shadow p-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Manage your subscription</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Update payment method, download invoices, or cancel.
            </p>
          </div>
          <form action={async () => { await createPortalSession(); }}>
            <button
              type="submit"
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Billing portal →
            </button>
          </form>
        </div>
      )}

      {/* Upgrade CTA — only for free plan without existing Stripe customer */}
      {isOnFreePlan && !hasStripeCustomer && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Upgrade your plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Growth */}
            <div className="bg-white rounded-xl shadow p-6 space-y-4">
              <div>
                <p className="font-bold text-xl">Growth</p>
                <p className="text-gray-500 text-sm">$29 / month</p>
                <p className="text-xs text-blue-600 font-medium mt-1">14-day free trial</p>
              </div>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>✓ Branded receipts</li>
                <li>✓ Rich reports</li>
                <li>✓ Unlimited students</li>
              </ul>
              <form action={async () => { await createCheckoutSession("growth_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Start 14-day trial
                </button>
              </form>
            </div>

            {/* Pro */}
            <div className="bg-white rounded-xl shadow border-2 border-blue-500 p-6 space-y-4">
              <div>
                <p className="font-bold text-xl">Pro</p>
                <p className="text-gray-500 text-sm">$99 / month</p>
                <p className="text-xs text-blue-600 font-medium mt-1">14-day free trial</p>
              </div>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>✓ Everything in Growth</li>
                <li>✓ Bulk operations</li>
                <li>✓ Accounting export</li>
                <li>✓ Advanced analytics</li>
              </ul>
              <form action={async () => { await createCheckoutSession("pro_monthly"); }}>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Start 14-day trial
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Legacy plan — can't self-serve upgrade */}
      {subscription.billing_exempt && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-gray-600 text-sm">
            You&apos;re on a legacy plan. Contact{" "}
            <a href="mailto:support@minerval.app" className="text-blue-600 hover:underline">
              support@minerval.app
            </a>{" "}
            to discuss upgrade options.
          </p>
        </div>
      )}
    </div>
  );
}
