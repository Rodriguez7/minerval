import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { ApproveButton } from "./ApproveButton";
import { localizePathname } from "@/lib/i18n/config";
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
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        styles[status] ?? "bg-zinc-100 text-zinc-600 border border-zinc-200"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
};

export default async function AdminPayoutsPage() {
  const locale = await getRequestLocale();
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();

  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect(localizePathname(locale, "/dashboard"));
  }

  const admin = getAdminClient();

  const { data: payouts } = await admin
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
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Demandes de versement" : "Payout requests"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr ? "Administration — vérifier et approuver les demandes de retrait" : "Administration — review and approve withdrawal requests"}
        </p>
      </div>

      {/* Pending */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "En attente d’approbation" : "Awaiting approval"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{pending.length}</span>
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">
              {fr ? "Aucune demande en attente." : "No pending requests."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["École", "Demande", "Commission", "À envoyer", "Téléphone", "Opérateur", "Demandé le", ""]
                  : ["School", "Request", "Commission", "To send", "Phone", "Provider", "Requested", ""]
                ).map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pending.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                    {(p.schools as { name?: string } | null)?.name ?? p.school_id}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                    {p.amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-red-600">
                    − {p.fee_amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-emerald-700">
                    {p.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.telecom}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3">
                    <ApproveButton payoutId={p.id} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Historique" : "History"}
            <span className="ml-2 text-xs font-normal text-zinc-400">{history.length}</span>
          </h2>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">
              {fr ? "Aucun historique pour le moment." : "No payout history yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["École", "Demande", "Commission", "Versé", "Téléphone", "Statut", "Date", "Suivi"]
                  : ["School", "Request", "Commission", "Paid", "Phone", "Status", "Date", "Follow-up"]
                ).map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {history.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                    {(p.schools as { name?: string } | null)?.name ?? p.school_id}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                    {p.amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-red-600">
                    − {p.fee_amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-emerald-700">
                    {p.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                  <td className="px-4 py-3">{statusBadge(p.status, fr)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString(fr ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3">
                    {p.status === "processing" ? (
                      <ResolvePayoutForm payoutId={p.id} locale={locale} />
                    ) : (
                      <div className="max-w-64 text-xs text-zinc-400">
                        {p.serdipay_transaction_id && <p>{fr ? "Transaction" : "Transaction"}: {p.serdipay_transaction_id}</p>}
                        {p.failure_reason && <p className="mt-1">{p.failure_reason}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
