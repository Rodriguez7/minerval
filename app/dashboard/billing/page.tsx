import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

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

      {/* Upgrade CTA — static skeleton */}
      {plan.monthly_price_usd === 0 && !subscription.billing_exempt && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-2">
          <p className="font-semibold text-blue-900">Unlock more features</p>
          <p className="text-sm text-blue-700">
            Upgrade to Growth or Pro to get branded receipts, rich reports, and
            more.
          </p>
          <p className="text-xs text-blue-500 mt-2">
            Plan upgrades coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
