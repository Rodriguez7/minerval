export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import {
  buildReportQuery,
  getStalePendingCutoff,
  parseReportFilters,
  type PaymentReportRow,
} from "@/lib/reporting";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import { RECONCILIATION_LABELS, TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";
import Link from "next/link";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold font-mono text-zinc-950 mt-2">{value}</p>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { school, plan } = await getTenantContext();

  if (!plan.can_rich_reports) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Rapports</h1>
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center space-y-4">
          <p className="text-sm text-zinc-500">
            Les rapports avances sont disponibles avec les plans Growth et Pro.
          </p>
          <a
            href="/dashboard/billing"
            className="inline-flex bg-zinc-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Voir les plans
          </a>
        </div>
      </div>
    );
  }

  const filters = parseReportFilters(await searchParams);
  const admin = getAdminClient();
  const staleCutoff = getStalePendingCutoff();

  const baseQuery = admin
    .from("payment_requests")
    .select(
      "id, amount, phone, telecom, status, created_at, settled_at, reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by, serdipay_transaction_id, students(full_name, external_id)"
    )
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data } = await buildReportQuery(baseQuery, filters);
  const rows = (data ?? []) as PaymentReportRow[];

  const totals = {
    initiated: rows.reduce((sum, row) => sum + Number(row.amount), 0),
    collected: rows
      .filter((row) => row.status === "success")
      .reduce((sum, row) => sum + Number(row.amount), 0),
    pending: rows
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + Number(row.amount), 0),
    failed: rows
      .filter((row) => row.status === "failed")
      .reduce((sum, row) => sum + Number(row.amount), 0),
    exceptions: rows.filter(
      (row) =>
        row.reconciliation_status !== "reconciled" ||
        (row.status === "pending" && row.created_at < staleCutoff)
    ).length,
  };

  const dailyTotals = Array.from(
    rows
      .reduce((map, row) => {
        const key = row.created_at.slice(0, 10);
        const current = map.get(key) ?? {
          date: key,
          count: 0,
          amount: 0,
          collected: 0,
        };
        current.count += 1;
        current.amount += Number(row.amount);
        if (row.status === "success") current.collected += Number(row.amount);
        map.set(key, current);
        return map;
      }, new Map<string, { date: string; count: number; amount: number; collected: number }>())
      .values()
  ).sort((a, b) => b.date.localeCompare(a.date));

  const exportParams = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    paymentStatus: filters.paymentStatus,
    reconciliationStatus: filters.reconciliationStatus,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Rapports</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Performance des paiements, exceptions de rapprochement et export CSV
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/reports/export?${exportParams.toString()}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Exporter en CSV
          </Link>
          <Link
            href="/dashboard/reconciliation"
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
            File de rapprochement
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-zinc-200 p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Du</label>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Au</label>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Statut du paiement</label>
          <select
            name="paymentStatus"
            defaultValue={filters.paymentStatus}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          >
            <option value="all">Tous</option>
            <option value="pending">En attente</option>
            <option value="success">Succes</option>
            <option value="failed">Echec</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Rapprochement</label>
          <select
            name="reconciliationStatus"
            defaultValue={filters.reconciliationStatus}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          >
            <option value="all">Tous</option>
            <option value="pending_review">En attente de verification</option>
            <option value="reconciled">Rapproche</option>
            <option value="needs_review">A verifier</option>
            <option value="manual_override">Resolution manuelle</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
          >
            Appliquer les filtres
          </button>
        </div>
      </form>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Lances" value={`${totals.initiated.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label="Encaisse" value={`${totals.collected.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label="En attente" value={`${totals.pending.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label="Echec" value={`${totals.failed.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label="Exceptions" value={String(totals.exceptions)} />
      </div>

      {/* Daily rollup + reconciliation breakdown */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Synthese journaliere</h2>
          </div>
          {dailyTotals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">Aucun paiement pour cette plage de filtres.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr className="border-b border-zinc-100">
                  {["Date", "Demandes", "Lances", "Encaisse"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dailyTotals.map((row) => (
                  <tr key={row.date} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-900">
                      {new Date(`${row.date}T00:00:00Z`).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-900">{row.count}</td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-600">
                      {row.amount.toLocaleString("fr-FR")} {school.currency}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-700">
                      {row.collected.toLocaleString("fr-FR")} {school.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Repartition du rapprochement</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {(["pending_review", "reconciled", "needs_review", "manual_override"] as const).map((status) => {
              const count = rows.filter((row) => row.reconciliation_status === status).length;
              return (
                <div key={status} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                  <span className="text-sm text-zinc-600">{RECONCILIATION_LABELS[status]}</span>
                  <span className="text-sm font-semibold font-mono text-zinc-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filtered transactions */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            Transactions filtrees
            <span className="ml-2 text-xs font-normal text-zinc-400">{rows.length}</span>
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucune transaction pour cette plage de filtres.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr className="border-b border-zinc-100">
                  {["Eleve", "Montant", "Operateur", "Paiement", "Rapprochement", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.slice(0, 100).map((row) => {
                  const student = takeJoined(row.students);
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-900">
                          {student?.full_name ?? "Eleve inconnu"}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">{student?.external_id ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                        {Number(row.amount).toLocaleString("fr-FR")} {school.currency}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {TELECOM_LABELS[row.telecom as Telecom] ?? row.telecom}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {row.status === "success"
                          ? "succes"
                          : row.status === "failed"
                            ? "echec"
                            : row.status === "pending"
                              ? "en attente"
                              : row.status}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-600">{RECONCILIATION_LABELS[row.reconciliation_status]}</p>
                        {row.reconciliation_note && (
                          <p className="text-xs text-zinc-400">{row.reconciliation_note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">
                        {new Date(row.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
