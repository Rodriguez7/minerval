export const dynamic = "force-dynamic";

import { getAuthenticatedSchool } from "@/lib/auth";
import {
  buildReportQuery,
  getStalePendingCutoff,
  parseReportFilters,
  type PaymentReportRow,
} from "@/lib/reporting";
import { RECONCILIATION_LABELS, TELECOM_LABELS } from "@/lib/types";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import Link from "next/link";
import { updateReconciliationStatus } from "../actions";
import type { Telecom } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const school = await getAuthenticatedSchool();
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
    .limit(200);

  const { data } = await buildReportQuery(baseQuery, filters);
  const rows = (data ?? []) as PaymentReportRow[];

  const exceptions = rows.filter(
    (row) =>
      row.reconciliation_status === "needs_review" ||
      row.reconciliation_status === "manual_override" ||
      (row.status === "pending" && row.created_at < staleCutoff)
  );

  const summary = {
    stalePending: rows.filter((row) => row.status === "pending" && row.created_at < staleCutoff),
    needsReview: rows.filter((row) => row.reconciliation_status === "needs_review"),
    overrides: rows.filter((row) => row.reconciliation_status === "manual_override"),
    reconciled: rows.filter((row) => row.reconciliation_status === "reconciled"),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation</h1>
          <p className="text-sm text-gray-500">
            Review stale pending requests, flag exceptions, and close discrepancies with
            an audit trail.
          </p>
        </div>
        <Link
          href="/dashboard/reports"
          className="text-sm text-blue-600 hover:underline"
        >
          Open reporting dashboard
        </Link>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Stale Pending"
          value={summary.stalePending.length}
          tone="yellow"
          sub={`${summary.stalePending.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString()} ${school.currency}`}
        />
        <SummaryCard
          label="Needs Review"
          value={summary.needsReview.length}
          tone="red"
          sub={`${summary.needsReview.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString()} ${school.currency}`}
        />
        <SummaryCard
          label="Manual Override"
          value={summary.overrides.length}
          tone="amber"
          sub={`${summary.overrides.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString()} ${school.currency}`}
        />
        <SummaryCard
          label="Reconciled"
          value={summary.reconciled.length}
          tone="green"
          sub={`${summary.reconciled.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString()} ${school.currency}`}
        />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Exception Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            Payments in this list are stale pending requests or items manually flagged for
            investigation.
          </p>
        </div>

        {exceptions.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No reconciliation exceptions for this filter range.</p>
        ) : (
          <div className="divide-y">
            {exceptions.map((row) => {
              const student = takeJoined(row.students);
              const stale = row.status === "pending" && row.created_at < staleCutoff;
              return (
                <div key={row.id} className="p-5 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">{student?.full_name ?? "Unknown student"}</p>
                      <p className="text-sm text-gray-500">
                        {student?.external_id ?? "—"} · {Number(row.amount).toLocaleString()} {school.currency} ·{" "}
                        {TELECOM_LABELS[row.telecom as Telecom] ?? row.telecom}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested {new Date(row.created_at).toLocaleString()}
                        {row.reconciliation_updated_at &&
                          ` · Last review ${new Date(row.reconciliation_updated_at).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge tone={row.status === "pending" ? "yellow" : row.status === "success" ? "green" : "red"}>
                        {row.status}
                      </Badge>
                      <Badge
                        tone={
                          row.reconciliation_status === "reconciled"
                            ? "green"
                            : row.reconciliation_status === "needs_review"
                            ? "red"
                            : row.reconciliation_status === "manual_override"
                            ? "amber"
                            : "yellow"
                        }
                      >
                        {RECONCILIATION_LABELS[row.reconciliation_status]}
                      </Badge>
                      {stale && <Badge tone="yellow">callback overdue</Badge>}
                    </div>
                  </div>

                  {row.reconciliation_note && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      {row.reconciliation_note}
                    </p>
                  )}

                  <form action={updateReconciliationStatus} className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <input type="hidden" name="paymentId" value={row.id} />
                      <input
                        name="note"
                        defaultValue={row.reconciliation_note ?? ""}
                        placeholder="Add reconciliation note"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="nextStatus"
                        value="needs_review"
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                      >
                        Needs review
                      </button>
                      <button
                        type="submit"
                        name="nextStatus"
                        value="manual_override"
                        className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                      >
                        Manual override
                      </button>
                      {row.status !== "pending" && (
                        <button
                          type="submit"
                          name="nextStatus"
                          value="reconciled"
                          className="rounded-lg border border-green-200 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                        >
                          Mark reconciled
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "yellow" | "red" | "amber" | "green";
}) {
  const toneClasses = {
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
  } as const;

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
        {label}
      </div>
      <p className="text-3xl font-bold mt-3">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "yellow" | "red" | "amber" | "green";
}) {
  const toneClasses = {
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-green-100 text-green-700",
  } as const;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
