export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import {
  buildReportQuery,
  getStalePendingCutoff,
  parseReportFilters,
  type PaymentReportRow,
} from "@/lib/reporting";
import { RECONCILIATION_LABELS, TELECOM_LABELS } from "@/lib/types";
import { createSSRClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import Link from "next/link";
import { updateReconciliationStatus } from "../actions";
import type { Telecom } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "yellow" | "red" | "amber" | "green";
}) {
  const toneClasses = {
    yellow: "bg-amber-50 text-amber-700 border border-amber-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    amber: "bg-orange-50 text-orange-700 border border-orange-200",
    green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  } as const;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
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
  const accent = {
    yellow: "text-amber-600",
    red: "text-red-600",
    amber: "text-orange-600",
    green: "text-emerald-600",
  } as const;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold font-mono mt-2 ${accent[tone]}`}>{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
    </div>
  );
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { school } = await getTenantContext();
  const filters = parseReportFilters(await searchParams);
  const supabase = await createSSRClient();
  const staleCutoff = getStalePendingCutoff();

  const baseQuery = supabase
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
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Rapprochement</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analysez les exceptions, signalez les ecarts et gardez une trace d&apos;audit
          </p>
        </div>
        <Link
          href="/dashboard/reports"
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          Ouvrir le tableau de bord des rapports
        </Link>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="En attente expire"
          value={summary.stalePending.length}
          tone="yellow"
          sub={`${summary.stalePending.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString("fr-FR")} ${school.currency}`}
        />
        <SummaryCard
          label="A verifier"
          value={summary.needsReview.length}
          tone="red"
          sub={`${summary.needsReview.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString("fr-FR")} ${school.currency}`}
        />
        <SummaryCard
          label="Resolution manuelle"
          value={summary.overrides.length}
          tone="amber"
          sub={`${summary.overrides.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString("fr-FR")} ${school.currency}`}
        />
        <SummaryCard
          label="Rapproche"
          value={summary.reconciled.length}
          tone="green"
          sub={`${summary.reconciled.reduce((sum, row) => sum + Number(row.amount), 0).toLocaleString("fr-FR")} ${school.currency}`}
        />
      </div>

      {/* Exception queue */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">File d&apos;exceptions</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Demandes en attente expirees et elements signales a examiner
          </p>
        </div>

        {exceptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucune exception de rapprochement pour cette plage de filtres.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {exceptions.map((row) => {
              const student = takeJoined(row.students);
              const stale = row.status === "pending" && row.created_at < staleCutoff;
              return (
                <div key={row.id} className="px-6 py-5 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {student?.full_name ?? "Eleve inconnu"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {student?.external_id ?? "—"} ·{" "}
                        <span className="font-mono">
                          {Number(row.amount).toLocaleString("fr-FR")} {school.currency}
                        </span>{" "}
                        · {TELECOM_LABELS[row.telecom as Telecom] ?? row.telecom}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Demande le {new Date(row.created_at).toLocaleString("fr-FR")}
                        {row.reconciliation_updated_at &&
                          ` · Derniere revue ${new Date(row.reconciliation_updated_at).toLocaleString("fr-FR")}`}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap shrink-0">
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
                      {stale && <Badge tone="yellow">callback en retard</Badge>}
                    </div>
                  </div>

                  {row.reconciliation_note && (
                    <p className="text-sm text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
                      {row.reconciliation_note}
                    </p>
                  )}

                  <form
                    action={updateReconciliationStatus}
                    className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <input type="hidden" name="paymentId" value={row.id} />
                      <input
                        name="note"
                        defaultValue={row.reconciliation_note ?? ""}
                        placeholder="Ajouter une note de rapprochement"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        name="nextStatus"
                        value="needs_review"
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors"
                      >
                        A verifier
                      </button>
                      <button
                        type="submit"
                        name="nextStatus"
                        value="manual_override"
                        className="rounded-lg border border-orange-200 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 transition-colors"
                      >
                        Resolution manuelle
                      </button>
                      {row.status !== "pending" && (
                        <button
                          type="submit"
                          name="nextStatus"
                          value="reconciled"
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
                        >
                          Marquer comme rapproche
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
