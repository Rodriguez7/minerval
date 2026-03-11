import { supabase } from "@/lib/supabase";
import { TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";

export default async function DashboardPage() {
  const { data: payments } = await supabase
    .from("payment_requests")
    .select(`
      id, amount, phone, telecom, status, created_at, settled_at, serdipay_transaction_id,
      students(name, external_id),
      schools(name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Payments Dashboard</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3">Student</th>
              <th className="p-3">School</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Status</th>
              <th className="p-3">TX ID</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments?.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  {(p.students as any)?.name}
                  <span className="text-gray-400 text-xs ml-1">({(p.students as any)?.external_id})</span>
                </td>
                <td className="p-3">{(p.schools as any)?.name}</td>
                <td className="p-3">{p.amount.toLocaleString()} FC</td>
                <td className="p-3">{p.phone}</td>
                <td className="p-3">{TELECOM_LABELS[p.telecom as Telecom] ?? p.telecom}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === "success" ? "bg-green-100 text-green-700"
                    : p.status === "failed" ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-3 text-gray-400 text-xs">{p.serdipay_transaction_id ?? "—"}</td>
                <td className="p-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!payments || payments.length === 0) && (
          <p className="p-4 text-gray-500">No payments yet.</p>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Dashboard has no access control in Phase 1.
      </p>
    </main>
  );
}
