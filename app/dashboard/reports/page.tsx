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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { school } = await getTenantContext();
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
        if (row.status === "success") {
          current.collected += Number(row.amount);
        }

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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-gray-500">
            Review payment performance, reconciliation exceptions, and export the filtered
            report as CSV.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/reports/export?${exportParams.toString()}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Export CSV
          </Link>
          <Link
            href="/dashboard/reconciliation"
            className="text-sm text-gray-600 hover:underline"
          >
            Open reconciliation queue
          </Link>
        </div>
      </div>

      <form className="bg-white rounded-xl shadow p-5 grid gap-4 md:grid-cols-5">
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment status</label>
          <select
            name="paymentStatus"
            defaultValue={filters.paymentStatus}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reconciliation</label>
          <select
            name="reconciliationStatus"
            defaultValue={filters.reconciliationStatus}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="all">All</option>
            <option value="pending_review">Pending review</option>
            <option value="reconciled">Reconciled</option>
            <option value="needs_review">Needs review</option>
            <option value="manual_override">Manual override</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Initiated" value={`${totals.initiated.toLocaleString()} ${school.currency}`} />
        <MetricCard label="Collected" value={`${totals.collected.toLocaleString()} ${school.currency}`} />
        <MetricCard label="Pending" value={`${totals.pending.toLocaleString()} ${school.currency}`} />
        <MetricCard label="Failed" value={`${totals.failed.toLocaleString()} ${school.currency}`} />
        <MetricCard label="Exceptions" value={String(totals.exceptions)} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Daily Rollup</h2>
          </div>
          {dailyTotals.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No payments in this filter range.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Date", "Requests", "Initiated", "Collected"].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-gray-500 font-medium"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {dailyTotals.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-3">{new Date(`${row.date}T00:00:00Z`).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{row.count}</td>
                    <td className="px-4 py-3">{row.amount.toLocaleString()} {school.currency}</td>
                    <td className="px-4 py-3">{row.collected.toLocaleString()} {school.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Reconciliation Breakdown</h2>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {(
              ["pending_review", "reconciled", "needs_review", "manual_override"] as const
            ).map((status) => {
              const count = rows.filter((row) => row.reconciliation_status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-gray-600">{RECONCILIATION_LABELS[status]}</span>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Filtered Transactions</h2>
        </div>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No transactions for this filter range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Student", "Amount", "Provider", "Payment", "Reconciliation", "Date"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left text-gray-500 font-medium"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.slice(0, 100).map((row) => {
                  const student = takeJoined(row.students);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        {student?.full_name ?? "Unknown student"}
                        <span className="block text-xs text-gray-400">
                          {student?.external_id ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{Number(row.amount).toLocaleString()} {school.currency}</td>
                      <td className="px-4 py-3">
                        {TELECOM_LABELS[row.telecom as Telecom] ?? row.telecom}
                      </td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">
                        {RECONCILIATION_LABELS[row.reconciliation_status]}
                        {row.reconciliation_note && (
                          <span className="block text-xs text-gray-400">
                            {row.reconciliation_note}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(row.created_at).toLocaleDateString()}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
