export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import { TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";
import { WithdrawForm } from "./WithdrawForm";

export default async function PayoutsPage() {
  const { school, membership } = await getTenantContext();
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

  const collectedData = data ?? [];
  const collected = collectedData.reduce(
    (sum: number, r: { amount: number; fee_amount: number | null }) =>
      sum + (r.amount - (r.fee_amount ?? 0)),
    0
  );

  const { data: inFlightData } = await admin
    .from("school_payouts")
    .select("amount")
    .eq("school_id", school.id)
    .in("status", ["pending", "processing"]);

  const inFlight = (inFlightData ?? []).reduce(
    (sum: number, r: { amount: number }) => sum + r.amount,
    0
  );
  const availableBalance = Math.max(0, collected - inFlight);

  const { data: payoutHistory } = await admin
    .from("school_payouts")
    .select("id, amount, phone, telecom, status, created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const canWithdraw = membership.role === "owner";
  const gross = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const fees = payments.reduce((sum, p) => sum + Number(p.fee_amount ?? 0), 0);
  const net = gross - fees;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border border-amber-200",
      processing: "bg-blue-50 text-blue-700 border border-blue-200",
      failed: "bg-red-50 text-red-700 border border-red-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
          styles[status] ?? "bg-zinc-100 text-zinc-600 border border-zinc-200"
        }`}
      >
        {status === "completed"
          ? "termine"
          : status === "pending"
            ? "en attente"
            : status === "processing"
              ? "en cours"
              : status === "failed"
                ? "echec"
                : status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Versements</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Paiements regles et montant net verse apres frais de plateforme
        </p>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Montant brut encaisse</p>
          <p className="text-2xl font-bold font-mono text-zinc-950 mt-2">
            {gross.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Frais plateforme</p>
          <p className="text-2xl font-bold font-mono text-red-600 mt-2">
            − {fees.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Net pour l&apos;ecole</p>
          <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            {net.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
      </div>

      {/* Available balance + withdraw */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Solde disponible</p>
            <p className="text-3xl font-bold font-mono text-zinc-950 mt-1">
              {availableBalance.toLocaleString("fr-FR")} {currency}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Apres deduction des demandes de retrait en cours</p>
          </div>
          {canWithdraw && (
            <WithdrawForm availableBalance={availableBalance} currency={currency} />
          )}
        </div>
      </div>

      {/* Payout history */}
      {(payoutHistory ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">Demandes de retrait</h2>
          </div>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Montant", "Telephone", "Operateur", "Statut", "Demande le"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(payoutHistory ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                    {p.amount.toLocaleString("fr-FR")} {school.currency}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.telecom}</td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Settled payments */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Paiements regles</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Les 200 paiements reussis les plus recents</p>
        </div>

        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucun paiement regle pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Eleve", "Brut", "Frais", "Montant ecole", "Operateur", "Regle le"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payments.map((p) => {
                const student = takeJoined(p.students);
                const feeAmt = Number(p.fee_amount ?? 0);
                const schoolAmt = Number(p.amount) - feeAmt;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-zinc-900">{student?.full_name ?? "—"}</p>
                      <p className="text-xs text-zinc-400 font-mono">{student?.external_id ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                      {Number(p.amount).toLocaleString("fr-FR")} {currency}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-red-600">
                      {feeAmt > 0 ? `− ${feeAmt.toLocaleString("fr-FR")} ${currency}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-emerald-700">
                      {schoolAmt.toLocaleString("fr-FR")} {currency}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {TELECOM_LABELS[p.telecom as Telecom] ?? p.telecom}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {p.settled_at ? new Date(p.settled_at).toLocaleString("fr-FR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
