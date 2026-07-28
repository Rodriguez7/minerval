export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { collectAllPages } from "@/lib/paged-query";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function AnalyticsPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const { school, plan } = await getTenantContext();

  if (!plan.can_advanced_analytics) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Analytique" : "Analytics"}</h1>
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center space-y-4">
          <p className="text-sm text-zinc-500">
            {fr ? "L’analytique avancée est disponible avec le plan Pro." : "Advanced analytics are available on the Pro plan."}
          </p>
          <LocalizedLink
            href="/dashboard/billing"
            className="inline-flex bg-zinc-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            {fr ? "Voir les plans" : "View plans"}
          </LocalizedLink>
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

  const [settledPayments, students] = await Promise.all([
    collectAllPages<{ amount: number; students: unknown }>((from, to) =>
      admin
        .from("payment_requests")
        .select("amount, students(class_name)")
        .eq("school_id", school.id)
        .eq("status", "success")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    collectAllPages<{ class_name: string | null; amount_due: number }>((from, to) =>
      admin
        .from("students")
        .select("class_name, amount_due")
        .eq("school_id", school.id)
        .gt("amount_due", 0)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);

  const collectionsByClass = new Map<string, number>();
  for (const p of settledPayments) {
    const className =
      (p.students as unknown as { class_name: string | null } | null)?.class_name ?? (fr ? "Sans classe" : "No class");
    collectionsByClass.set(
      className,
      (collectionsByClass.get(className) ?? 0) + Number(p.amount)
    );
  }

  const outstandingByClass = new Map<string, number>();
  for (const s of students) {
    const className = s.class_name ?? (fr ? "Sans classe" : "No class");
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Analytique" : "Analytics"}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Performance des paiements et répartition des encaissements" : "Payment performance and collection breakdown"}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {fr ? "Taux de succès" : "Success rate"}
          </p>
          <p className="text-3xl font-bold font-mono text-zinc-950 mt-2">{successRate}%</p>
          <p className="text-xs text-zinc-400 mt-1">
            {fr
              ? `${succeeded.toLocaleString("fr-FR")} paiements réussis sur ${total.toLocaleString("fr-FR")} lancés`
              : `${succeeded.toLocaleString("en-US")} successful payments out of ${total.toLocaleString("en-US")}`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {fr ? "Total encaissé" : "Total collected"}
          </p>
          <p className="text-3xl font-bold font-mono text-emerald-700 mt-2">
            {totalCollected.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {fr ? "Total impayé" : "Total outstanding"}
          </p>
          <p className="text-3xl font-bold font-mono text-amber-600 mt-2">
            {totalOutstanding.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
      </div>

      {/* By class */}
      {allClasses.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Par classe" : "By class"}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {fr ? "Encaissements et soldes restants par classe" : "Collections and outstanding balances by class"}
            </p>
          </div>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  {fr ? "Classe" : "Class"}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  {fr ? "Encaissé" : "Collected"}
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  {fr ? "Impayé" : "Outstanding"}
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
