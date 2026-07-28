import { getAdminClient } from "@/lib/supabase";
import { getRequestLocale } from "@/lib/i18n/server";
import { TELECOM_LABELS, type Telecom } from "@/lib/types";
import { takeJoined } from "@/lib/supabase-joins";
import { ApproveButton } from "./ApproveButton";
import { ResolvePayoutForm } from "./ResolvePayoutForm";

export const dynamic = "force-dynamic";

function statusBadge(status: string, fr: boolean) {
  const labels: Record<string, string> = fr
    ? { pending: "À approuver", processing: "En cours", completed: "Terminé", failed: "Échec" }
    : { pending: "To approve", processing: "Processing", completed: "Completed", failed: "Failed" };
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-blue-700",
    failed: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default async function AdminPayoutsPage() {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const { data: payouts } = await getAdminClient()
    .from("school_payouts")
    .select(
      "id,school_id,amount,fee_amount,net_amount,phone,telecom,status,created_at,failure_reason,serdipay_transaction_id,schools(name,currency,verification_status)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (payouts ?? []).filter((payout) => payout.status === "pending");
  const history = (payouts ?? []).filter((payout) => payout.status !== "pending");

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {fr ? "Versements" : "Payouts"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Demandes de retrait" : "Withdrawal requests"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fr
            ? "Vérifiez chaque demande avant d’envoyer les fonds."
            : "Review every request before sending funds."}
        </p>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "À approuver" : "To approve"}
          </h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            {pending.length}
          </span>
        </div>
        <div className="grid gap-4">
          {pending.map((payout) => {
            const school = takeJoined(payout.schools);
            const currency = school?.currency ?? "";
            const verified = school?.verification_status === "verified";
            return (
              <article key={payout.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-950">
                      {school?.name ?? payout.school_id}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(payout.created_at).toLocaleString(fr ? "fr-FR" : "en-US")}
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                    verified ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                    {verified
                      ? fr ? "Établissement vérifié" : "School verified"
                      : fr ? "Vérification manquante" : "Verification missing"}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    [fr ? "Montant demandé" : "Requested", `${payout.amount.toLocaleString(fr ? "fr-FR" : "en-US")} ${currency}`],
                    [fr ? "Commission" : "Fee", `${payout.fee_amount.toLocaleString(fr ? "fr-FR" : "en-US")} ${currency}`],
                    [fr ? "Montant à envoyer" : "Amount to send", `${payout.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")} ${currency}`],
                    ["Mobile Money", payout.phone],
                    [fr ? "Opérateur" : "Provider", TELECOM_LABELS[payout.telecom as Telecom] ?? payout.telecom],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-zinc-400">{label}</dt>
                      <dd className="mt-1 text-sm font-semibold text-zinc-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-zinc-500">
                    {fr
                      ? "L’approbation déclenche un versement Mobile Money réel."
                      : "Approval triggers a real Mobile Money payout."}
                  </p>
                  {verified ? (
                    <ApproveButton payoutId={payout.id} locale={locale} />
                  ) : (
                    <span className="text-xs font-semibold text-red-700">
                      {fr ? "Approbation bloquée" : "Approval blocked"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
              {fr ? "Aucune demande à approuver." : "No requests to approve."}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">
          {fr ? "Suivi et historique" : "Tracking and history"} · {history.length}
        </h2>
        <div className="grid gap-3">
          {history.map((payout) => {
            const school = takeJoined(payout.schools);
            const currency = school?.currency ?? "";
            return (
              <article key={payout.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-zinc-950">{school?.name ?? payout.school_id}</h3>
                      {statusBadge(payout.status, fr)}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {payout.net_amount.toLocaleString(fr ? "fr-FR" : "en-US")} {currency}
                      {" · "}
                      {payout.phone}
                      {" · "}
                      {TELECOM_LABELS[payout.telecom as Telecom] ?? payout.telecom}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(payout.created_at).toLocaleString(fr ? "fr-FR" : "en-US")}
                    </p>
                    {payout.serdipay_transaction_id && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Transaction SerdiPay: {payout.serdipay_transaction_id}
                      </p>
                    )}
                    {payout.failure_reason && payout.status !== "processing" && (
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">
                        {payout.failure_reason}
                      </p>
                    )}
                  </div>
                  {payout.status === "processing" && (
                    <ResolvePayoutForm payoutId={payout.id} locale={locale} />
                  )}
                </div>
              </article>
            );
          })}
          {history.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              {fr ? "Aucun historique pour le moment." : "No payout history yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
