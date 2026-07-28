export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { takeJoined } from "@/lib/supabase-joins";
import { TELECOM_LABELS } from "@/lib/types";
import type { Telecom } from "@/lib/types";
import { WithdrawForm } from "./WithdrawForm";
import { getRequestLocale } from "@/lib/i18n/server";
import { getVerificationDocuments } from "@/lib/verification-documents";
import { VerificationDocumentsForm } from "@/app/dashboard/settings/VerificationDocumentsForm";

export default async function PayoutsPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
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
  const totals = await getCollectedTotals(admin, school.id);

  const { data: inFlightData } = await admin
    .from("school_payouts")
    .select("amount")
    .eq("school_id", school.id)
    .neq("status", "failed");

  const inFlight = (inFlightData ?? []).reduce(
    (sum: number, r: { amount: number }) => sum + r.amount,
    0
  );
  const availableBalance = Math.max(0, totals.net - inFlight);

  const { data: payoutHistory } = await admin
    .from("school_payouts")
    .select("id, amount, fee_amount, net_amount, phone, telecom, status, created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const canWithdraw = membership.role === "owner" && school.verification_status === "verified";
  const needsVerification = membership.role === "owner" && school.verification_status !== "verified";
  const verificationDocuments = needsVerification
    ? await getVerificationDocuments(admin, school.id)
    : [];
  const { gross, fees, net } = totals;

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
          ? fr ? "terminé" : "completed"
          : status === "pending"
            ? fr ? "en attente" : "pending"
            : status === "processing"
              ? fr ? "en cours" : "processing"
              : status === "failed"
                ? fr ? "échec" : "failed"
                : status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Versements" : "Payouts"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Paiements réglés et montant net versé après frais de plateforme" : "Settled payments and net payout after platform fees"}
        </p>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Montant brut encaissé" : "Gross collected"}</p>
          <p className="text-2xl font-bold font-mono text-zinc-950 mt-2">
            {gross.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Frais de plateforme" : "Platform fees"}</p>
          <p className="text-2xl font-bold font-mono text-red-600 mt-2">
            − {fees.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Net pour l’école" : "Net to school"}</p>
          <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            {net.toLocaleString("fr-FR")} {currency}
          </p>
        </div>
      </div>

      {/* Available balance + withdraw */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{fr ? "Solde disponible" : "Available balance"}</p>
            <p className="text-3xl font-bold font-mono text-zinc-950 mt-1">
              {availableBalance.toLocaleString("fr-FR")} {currency}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{fr ? "Après déduction de tous les retraits non échoués" : "After all active withdrawal requests"}</p>
          </div>
          {canWithdraw && (
            <WithdrawForm availableBalance={availableBalance} currency={currency} />
          )}
        </div>
        {needsVerification && (
          <div className="mt-6 border-t border-zinc-100 pt-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">
                {fr ? "Vérification requise avant le premier versement" : "Verification required before the first payout"}
              </p>
              <p className="mt-1 leading-6">
                {school.verification_status === "pending"
                  ? fr
                    ? "Votre dossier est en cours d’examen. Vous pouvez encore ajouter un document si nécessaire."
                    : "Your application is under review. You can still add a document if needed."
                  : fr
                    ? "Ajoutez les documents officiels de l’établissement. Minerval les examinera avant d’activer les versements."
                    : "Upload the school’s official documents. Minerval will review them before enabling payouts."}
              </p>
              {school.verification_rejection_reason && (
                <p className="mt-2 font-medium">
                  {fr ? "Correction demandée :" : "Changes requested:"}{" "}
                  {school.verification_rejection_reason}
                </p>
              )}
            </div>
            <VerificationDocumentsForm
              documents={verificationDocuments}
              canManage
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* Payout history */}
      {(payoutHistory ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Demandes de retrait" : "Withdrawal requests"}</h2>
          </div>
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["Demande", "Commission", "Versé à l’école", "Téléphone", "Opérateur", "Statut", "Demandé le"]
                  : ["Requested", "Fee", "Paid to school", "Phone", "Operator", "Status", "Requested on"]
                ).map((h) => (
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
                  <td className="px-4 py-3 text-sm font-mono text-red-600">
                    − {p.fee_amount.toLocaleString("fr-FR")} {school.currency}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-emerald-700">
                    {p.net_amount.toLocaleString("fr-FR")} {school.currency}
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
          <h2 className="text-sm font-semibold text-zinc-900">{fr ? "Paiements réglés" : "Settled payments"}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{fr ? "Les 200 paiements réussis les plus récents" : "The 200 most recent successful payments"}</p>
        </div>

        {payments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">{fr ? "Aucun paiement réglé pour le moment." : "No settled payments yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["Élève", "Brut", "Frais", "Montant école", "Opérateur", "Réglé le"]
                  : ["Student", "Gross", "Fees", "School amount", "Operator", "Settled on"]
                ).map((h) => (
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

async function getCollectedTotals(
  admin: ReturnType<typeof getAdminClient>,
  schoolId: string
) {
  const pageSize = 1_000;
  let offset = 0;
  let gross = 0;
  let fees = 0;

  while (true) {
    const { data, error } = await admin
      .from("payment_requests")
      .select("amount, fee_amount")
      .eq("school_id", schoolId)
      .eq("status", "success")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    const rows = data ?? [];
    for (const row of rows) {
      gross += Number(row.amount);
      fees += Number(row.fee_amount ?? 0);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return { gross, fees, net: gross - fees };
}
