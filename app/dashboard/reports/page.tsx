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
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { collectAllPages } from "@/lib/paged-query";
import { clampPage, parsePage } from "@/lib/pagination";
import { Pagination } from "../Pagination";
import { getRequestLocale } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const REPORT_PAGE_SIZE = 100;

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
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const reconciliationLabels = fr
    ? RECONCILIATION_LABELS
    : {
        pending_review: "Pending review",
        reconciled: "Reconciled",
        needs_review: "Needs review",
        manual_override: "Manual resolution",
      };
  const { school, plan } = await getTenantContext();

  if (!plan.can_rich_reports) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Rapports" : "Reports"}</h1>
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center space-y-4">
          <p className="text-sm text-zinc-500">
            {fr ? "Les rapports avancés sont disponibles avec les plans Growth et Pro." : "Advanced reports are available on Growth and Pro plans."}
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

  const resolvedSearchParams = await searchParams;
  const filters = parseReportFilters(resolvedSearchParams);
  const admin = getAdminClient();
  const staleCutoff = getStalePendingCutoff();

  const rows = await collectAllPages<PaymentReportRow>((from, to) =>
    buildReportQuery(
      admin
        .from("payment_requests")
        .select(
          "id, amount, phone, telecom, status, created_at, settled_at, reconciliation_status, reconciliation_note, reconciliation_updated_at, reconciliation_updated_by, serdipay_transaction_id, students(full_name, external_id)"
        )
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .range(from, to),
      filters
    )
  );
  const page = clampPage(parsePage(resolvedSearchParams.page), rows.length, REPORT_PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE);

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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{fr ? "Rapports" : "Reports"}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {fr ? "Performance des paiements, exceptions de rapprochement et export CSV" : "Payment performance, reconciliation exceptions, and CSV export"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LocalizedLink
            href={`/dashboard/reports/export?${exportParams.toString()}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {fr ? "Exporter en CSV" : "Export CSV"}
          </LocalizedLink>
          <LocalizedLink
            href="/dashboard/reconciliation"
            className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
            {fr ? "File de rapprochement" : "Reconciliation queue"}
          </LocalizedLink>
        </div>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-zinc-200 p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Du" : "From"}</label>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Au" : "To"}</label>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Statut du paiement" : "Payment status"}</label>
          <select
            name="paymentStatus"
            defaultValue={filters.paymentStatus}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          >
            <option value="all">{fr ? "Tous" : "All"}</option>
            <option value="pending">{fr ? "En attente" : "Pending"}</option>
            <option value="success">{fr ? "Succès" : "Success"}</option>
            <option value="failed">{fr ? "Échec" : "Failed"}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Rapprochement" : "Reconciliation"}</label>
          <select
            name="reconciliationStatus"
            defaultValue={filters.reconciliationStatus}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
          >
            <option value="all">{fr ? "Tous" : "All"}</option>
            <option value="pending_review">{reconciliationLabels.pending_review}</option>
            <option value="reconciled">{reconciliationLabels.reconciled}</option>
            <option value="needs_review">{reconciliationLabels.needs_review}</option>
            <option value="manual_override">{reconciliationLabels.manual_override}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 text-white py-2 text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
          >
            {fr ? "Appliquer les filtres" : "Apply filters"}
          </button>
        </div>
      </form>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label={fr ? "Lancés" : "Initiated"} value={`${totals.initiated.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label={fr ? "Encaissé" : "Collected"} value={`${totals.collected.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label={fr ? "En attente" : "Pending"} value={`${totals.pending.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label={fr ? "Échec" : "Failed"} value={`${totals.failed.toLocaleString("fr-FR")} ${school.currency}`} />
        <MetricCard label={fr ? "Exceptions" : "Exceptions"} value={String(totals.exceptions)} />
      </div>

      {/* Daily rollup + reconciliation breakdown */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Synthèse journalière" : "Daily summary"}</h2>
          </div>
          {dailyTotals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">{fr ? "Aucun paiement pour cette plage de filtres." : "No payments for these filters."}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr className="border-b border-zinc-100">
                  {(fr ? ["Date", "Demandes", "Lancés", "Encaissé"] : ["Date", "Requests", "Initiated", "Collected"]).map((h) => (
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
            <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Répartition du rapprochement" : "Reconciliation breakdown"}</h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {(["pending_review", "reconciled", "needs_review", "manual_override"] as const).map((status) => {
              const count = rows.filter((row) => row.reconciliation_status === status).length;
              return (
                <div key={status} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                  <span className="text-sm text-zinc-600">{reconciliationLabels[status]}</span>
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
            {fr ? "Transactions filtrées" : "Filtered transactions"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{rows.length}</span>
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">{fr ? "Aucune transaction pour cette plage de filtres." : "No transactions for these filters."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr className="border-b border-zinc-100">
                  {(fr
                    ? ["Élève", "Montant", "Opérateur", "Paiement", "Rapprochement", "Date"]
                    : ["Student", "Amount", "Operator", "Payment", "Reconciliation", "Date"]
                  ).map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pageRows.map((row) => {
                  const student = takeJoined(row.students);
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-900">
                          {student?.full_name ?? (fr ? "Élève inconnu" : "Unknown student")}
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
                          ? fr ? "succès" : "success"
                          : row.status === "failed"
                            ? fr ? "échec" : "failed"
                            : row.status === "pending"
                              ? fr ? "en attente" : "pending"
                              : row.status}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-zinc-600">{reconciliationLabels[row.reconciliation_status]}</p>
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
        <Pagination
          basePath="/dashboard/reports"
          page={page}
          pageSize={REPORT_PAGE_SIZE}
          searchParams={resolvedSearchParams}
          totalItems={rows.length}
        />
      </div>
    </div>
  );
}
