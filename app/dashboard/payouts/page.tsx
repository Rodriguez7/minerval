export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import { TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";

export default async function PayoutsPage() {
  const { school } = await getTenantContext();
  const admin = getAdminClient();

  const { data } = await admin
    .from("payment_requests")
    .select(
      "id, amount, fee_amount, settled_at, telecom, students(full_name, external_id)"
    )
    .eq("school_id", school.id)
    .eq("status", "success")
    .order("settled_at", { ascending: false })
    .limit(200);

  const payments = data ?? [];
  const currency = school.currency ?? "FC";

  const gross = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const fees = payments.reduce((sum, p) => sum + Number(p.fee_amount ?? 0), 0);
  const net = gross - fees;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Settled payments and your net payout after platform fees.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Gross collected</p>
          <p className="text-2xl font-bold mt-1">
            {gross.toLocaleString()} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Platform fees</p>
          <p className="text-2xl font-bold mt-1 text-red-600">
            − {fees.toLocaleString()} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Net school payout</p>
          <p className="text-2xl font-bold mt-1 text-green-700">
            {net.toLocaleString()} {currency}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Settled payments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Most recent 200 successful payments.
          </p>
        </div>

        {payments.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No settled payments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Student</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Gross</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Fee</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">School amount</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Provider</th>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Settled at</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => {
                const student = takeJoined(p.students);
                const feeAmt = Number(p.fee_amount ?? 0);
                const schoolAmt = Number(p.amount) - feeAmt;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium">{student?.full_name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{student?.external_id ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {Number(p.amount).toLocaleString()} {currency}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600">
                      {feeAmt > 0 ? `− ${feeAmt.toLocaleString()} ${currency}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-green-700">
                      {schoolAmt.toLocaleString()} {currency}
                    </td>
                    <td className="px-5 py-3">
                      {TELECOM_LABELS[p.telecom as Telecom] ?? p.telecom}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {p.settled_at
                        ? new Date(p.settled_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
