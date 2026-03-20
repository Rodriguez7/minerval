export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import Link from "next/link";

export default async function AnalyticsPage() {
  const { school, plan } = await getTenantContext();

  if (!plan.can_advanced_analytics) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
          <p className="text-gray-500">
            Advanced analytics are available on the Pro plan.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-block bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            View plans
          </Link>
        </div>
      </div>
    );
  }

  const admin = getAdminClient();
  const currency = school.currency ?? "FC";

  // Payment success rate (all time)
  const [{ count: total }, { count: succeeded }] = await Promise.all([
    admin
      .from("payment_requests")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school.id)
      .then((r) => ({ count: r.count ?? 0 })),
    admin
      .from("payment_requests")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school.id)
      .eq("status", "success")
      .then((r) => ({ count: r.count ?? 0 })),
  ]);

  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;

  // Collections by class (sum of settled payment amounts per class)
  const { data: settledPayments } = await admin
    .from("payment_requests")
    .select("amount, students(class_name)")
    .eq("school_id", school.id)
    .eq("status", "success");

  // Outstanding balance by class (sum of amount_due per class)
  const { data: students } = await admin
    .from("students")
    .select("class_name, amount_due")
    .eq("school_id", school.id)
    .gt("amount_due", 0);

  // Aggregate collections by class
  const collectionsByClass = new Map<string, number>();
  for (const p of settledPayments ?? []) {
    const className = (p.students as { class_name: string | null } | null)?.class_name ?? "No class";
    collectionsByClass.set(
      className,
      (collectionsByClass.get(className) ?? 0) + Number(p.amount)
    );
  }

  // Aggregate outstanding by class
  const outstandingByClass = new Map<string, number>();
  for (const s of students ?? []) {
    const className = s.class_name ?? "No class";
    outstandingByClass.set(
      className,
      (outstandingByClass.get(className) ?? 0) + Number(s.amount_due)
    );
  }

  const allClasses = Array.from(
    new Set([...collectionsByClass.keys(), ...outstandingByClass.keys()])
  ).sort();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Payment performance and collection breakdown.
        </p>
      </div>

      {/* Success rate */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Payment success rate</p>
          <p className="text-3xl font-bold mt-1">{successRate}%</p>
          <p className="text-xs text-gray-400 mt-1">
            {succeeded} of {total} initiated payments succeeded
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total collected</p>
          <p className="text-3xl font-bold mt-1">
            {Array.from(collectionsByClass.values())
              .reduce((s, v) => s + v, 0)
              .toLocaleString()}{" "}
            {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-gray-500">Total outstanding</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">
            {Array.from(outstandingByClass.values())
              .reduce((s, v) => s + v, 0)
              .toLocaleString()}{" "}
            {currency}
          </p>
        </div>
      </div>

      {/* By class */}
      {allClasses.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold">By class</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-600">Class</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Collected</th>
                <th className="px-5 py-3 text-right font-medium text-gray-600">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allClasses.map((cls) => (
                <tr key={cls} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{cls}</td>
                  <td className="px-5 py-3 text-right text-green-700">
                    {(collectionsByClass.get(cls) ?? 0).toLocaleString()} {currency}
                  </td>
                  <td className="px-5 py-3 text-right text-amber-600">
                    {(outstandingByClass.get(cls) ?? 0).toLocaleString()} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
