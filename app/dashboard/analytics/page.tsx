export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import Link from "next/link";

export default async function AnalyticsPage() {
  const { school, plan } = await getTenantContext();

  if (!plan.can_advanced_analytics) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Analytique</h1>
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center space-y-4">
          <p className="text-sm text-zinc-500">
            L&apos;analytique avancee est disponible avec le plan Pro.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex bg-zinc-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Voir les plans
          </Link>
        </div>
      </div>
    );
  }

  const admin = getAdminClient();
  const currency = school.currency ?? "FC";

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

  const { data: settledPayments } = await admin
    .from("payment_requests")
    .select("amount, students(class_name)")
    .eq("school_id", school.id)
    .eq("status", "success");

  const { data: students } = await admin
    .from("students")
    .select("class_name, amount_due")
    .eq("school_id", school.id)
    .gt("amount_due", 0);

  const collectionsByClass = new Map<string, number>();
  for (const p of settledPayments ?? []) {
    const className =
      (p.students as unknown as { class_name: string | null } | null)?.class_name ?? "Sans classe";
    collectionsByClass.set(
      className,
      (collectionsByClass.get(className) ?? 0) + Number(p.amount)
    );
  }

  const outstandingByClass = new Map<string, number>();
  for (const s of students ?? []) {
    const className = s.class_name ?? "Sans classe";
    outstandingByClass.set(
      className,
      (outstandingByClass.get(className) ?? 0) + Number(s.amount_due)
    );
  }

  const allClasses = Array.from(
    new Set([...collectionsByClass.keys(), ...outstandingByClass.keys()])
  ).sort();

  const totalCollected = Array.from(collectionsByClass.values()).reduce((s, v) => s + v, 0);
  const totalOutstanding = Array.from(outstandingByClass.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Analytique</h1>
        <p className="text-sm text-zinc-500 mt-1">Performance des paiements et repartition des encaissements</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Taux de succes</p>
          <p className="text-3xl font-bold font-mono text-zinc-950 mt-2">{successRate}%</p>
          <p className="text-xs text-zinc-400 mt-1">
            {succeeded.toLocaleString("fr-FR")} paiements reussis sur {total.toLocaleString("fr-FR")} lances
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total encaisse</p>
          <p className="text-3xl font-bold font-mono text-emerald-700 mt-2">
            {totalCollected.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total impaye</p>
          <p className="text-3xl font-bold font-mono text-amber-600 mt-2">
            {totalOutstanding.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
      </div>

      {/* By class */}
      {allClasses.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Par classe</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Encaissements et soldes restants par classe</p>
          </div>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Classe
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Encaisse
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Impaye
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {allClasses.map((cls) => (
                <tr key={cls} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-zinc-900">{cls}</td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-emerald-700">
                    {(collectionsByClass.get(cls) ?? 0).toLocaleString("fr-FR")} {currency}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-amber-600">
                    {(outstandingByClass.get(cls) ?? 0).toLocaleString("fr-FR")} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
