import { getAdminClient } from "@/lib/supabase";
import { ApproveButton } from "./ApproveButton";
import { getRequestLocale } from "@/lib/i18n/server";
import { ResolvePayoutForm } from "./ResolvePayoutForm";

const statusBadge = (status: string, fr: boolean) => {
  const labels: Record<string, string> = fr
    ? { pending: "En attente", processing: "En cours", completed: "Terminé", failed: "Échec" }
    : { pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed" };
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    processing: "bg-blue-50 text-blue-700 border border-blue-200",
    failed: "bg-red-50 text-red-700 border border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "border border-zinc-200 bg-zinc-100 text-zinc-600"}`}>
      {labels[status] ?? status}
    </span>
  );
};

export default async function AdminPayoutsPage() {
  const locale = await getRequestLocale();
  const { data: payouts } = await getAdminClient()
    .from("school_payouts")
    .select(
      "id, school_id, amount, fee_amount, net_amount, phone, telecom, status, created_at, requested_by, failure_reason, serdipay_transaction_id, schools(name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (payouts ?? []).filter((p) => p.status === "pending");
  const history = (payouts ?? []).filter((p) => p.status !== "pending");
  const fr = locale === "fr";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Demandes de versement" : "Payout requests"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fr ? "Vérifiez et approuvez les demandes de retrait des établissements." : "Review and approve school withdrawal requests."}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "En attente d’approbation" : "Awaiting approval"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{pending.length}</span>
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            {fr ? "Aucune demande en attente." : "No pending requests."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  {(fr
                    ? ["École", "Demande", "Commission", "À envoyer", "Téléphone", "Opérateur", "Demandé le", ""]
                    : ["School", "Request", "Commission", "To send", "Phone", "Provider", "Requested", ""]
                  ).map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pending.map((payout) => (
                  <tr key={payout.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{(payout.schools as { name?: string } | null)?.name ?? payout.school_id}</td>
                    <td className="px-4 py-3 font-mono text-sm">{payout.amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 font-mono text-sm text-red-600">− {payout.fee_amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-emerald-700">{payout.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{payout.phone}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{payout.telecom}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{new Date(payout.created_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3"><ApproveButton payoutId={payout.id} locale={locale} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Historique" : "History"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{history.length}</span>
          </h2>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-zinc-400">
            {fr ? "Aucun historique pour le moment." : "No payout history yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  {(fr
                    ? ["École", "Demande", "Commission", "Versé", "Téléphone", "Statut", "Date", "Suivi"]
                    : ["School", "Request", "Commission", "Paid", "Phone", "Status", "Date", "Follow-up"]
                  ).map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.map((payout) => (
                  <tr key={payout.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{(payout.schools as { name?: string } | null)?.name ?? payout.school_id}</td>
                    <td className="px-4 py-3 font-mono text-sm">{payout.amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 font-mono text-sm text-red-600">− {payout.fee_amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-emerald-700">{payout.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{payout.phone}</td>
                    <td className="px-4 py-3">{statusBadge(payout.status, fr)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{new Date(payout.created_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}</td>
                    <td className="px-4 py-3">
                      {payout.status === "processing" ? (
                        <ResolvePayoutForm payoutId={payout.id} locale={locale} />
                      ) : (
                        <div className="max-w-64 text-xs text-zinc-400">
                          {payout.serdipay_transaction_id && <p>Transaction: {payout.serdipay_transaction_id}</p>}
                          {payout.failure_reason && <p className="mt-1">{payout.failure_reason}</p>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
