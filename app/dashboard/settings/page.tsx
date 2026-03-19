export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { updatePricingPolicy } from "@/app/actions/settings";

export default async function SettingsPage() {
  const { school, membership } = await getTenantContext();
  const canManage = ["owner", "admin"].includes(membership.role);
  const admin = getAdminClient();

  const { data: policy } = await admin
    .from("school_pricing_policies")
    .select("parent_fee_bps, fee_display_mode")
    .eq("school_id", school.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">Pricing Policy</h2>
        <p className="text-sm text-gray-500">
          Controls what fee parents pay on top of the school fee amount.
        </p>
        <form
          action={updatePricingPolicy.bind(null, undefined)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Parent fee
              <span className="text-gray-400 font-normal ml-2">
                (basis points — 275 = 2.75%)
              </span>
            </label>
            <input
              name="parentFeeBps"
              type="number"
              min="0"
              max="1000"
              defaultValue={policy?.parent_fee_bps ?? 275}
              disabled={!canManage}
              className="border rounded-lg px-3 py-2 text-sm w-32 disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fee display mode</label>
            <select
              name="feeDisplayMode"
              defaultValue={policy?.fee_display_mode ?? "visible_line_item"}
              disabled={!canManage}
              className="border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50"
            >
              <option value="visible_line_item">
                Visible line item — shown separately on payment page
              </option>
              <option value="hidden">Hidden — absorbed into total, not shown</option>
            </select>
          </div>

          {canManage && (
            <button
              type="submit"
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Save changes
            </button>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-2">
        <h2 className="font-semibold">School info</h2>
        <div className="text-sm space-y-1">
          <div className="flex gap-4">
            <span className="text-gray-500 w-28">Name</span>
            <span>{school.name}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500 w-28">Code</span>
            <span className="font-mono">{school.code}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500 w-28">Currency</span>
            <span>{school.currency}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500 w-28">Timezone</span>
            <span>{school.timezone}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
