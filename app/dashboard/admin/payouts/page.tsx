import { redirect } from "next/navigation";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { ApproveButton } from "./ApproveButton";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Termine",
  failed: "Echec",
};

const statusBadge = (status: string) => {
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
      {STATUS_LABELS[status] ?? status}
    </span>
  );
};

export default async function AdminPayoutsPage() {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();

  if (!user || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const admin = getAdminClient();

  const { data: payouts } = await admin
    .from("school_payouts")
    .select(
      "id, school_id, amount, phone, telecom, status, created_at, requested_by, schools(name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (payouts ?? []).filter((p) => p.status === "pending");
  const history = (payouts ?? []).filter((p) => p.status !== "pending");

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Demandes de versement</h1>
        <p className="text-sm text-zinc-500 mt-1">Admin - verifier et approuver les demandes de retrait</p>
      </div>

      {/* Pending */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            En attente d&apos;approbation
            <span className="ml-2 text-xs font-normal text-zinc-400">{pending.length}</span>
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucune demande en attente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Ecole", "Montant", "Telephone", "Operateur", "Demande le", ""].map((h) => (
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
                    {p.amount.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.telecom}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <ApproveButton payoutId={p.id} />
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
            Historique
            <span className="ml-2 text-xs font-normal text-zinc-400">{history.length}</span>
          </h2>
        </div>
        {history.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucun historique pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto"><table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Ecole", "Montant", "Telephone", "Statut", "Date"].map((h) => (
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
                    {p.amount.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{p.phone}</td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
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
