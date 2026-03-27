export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";
import { createFee, toggleFeeActive } from "../actions";

export default async function FeesPage() {
  const { school } = await getTenantContext();
  const supabase = await createSSRClient();

  const { data: fees } = await supabase
    .from("fees")
    .select("id, title, type, amount, active, created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Frais</h1>
        <p className="text-sm text-zinc-500 mt-1">Definissez les structures de frais recurrentes et exceptionnelles</p>
      </div>

      {/* Create fee form */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Creer un frais</h2>
        <form
          action={createFee.bind(null, null) as (formData: FormData) => void}
          className="flex flex-wrap gap-3 items-end"
        >
          <div className="space-y-1.5 flex-1 min-w-44">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Intitule du frais <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              placeholder="ex. Frais de scolarite"
              required
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Type</label>
            <select
              name="type"
              required
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            >
              <option value="recurring">Recurrent</option>
              <option value="special">Exceptionnel</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Montant ({school.currency}) <span className="text-red-500">*</span>
            </label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
              className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <button
            type="submit"
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
          >
            Creer
          </button>
        </form>
      </div>

      {/* Fee list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            Grille des frais
            <span className="ml-2 text-xs font-normal text-zinc-400">{fees?.length ?? 0}</span>
          </h2>
        </div>
        <div className="overflow-x-auto"><table>
          <thead>
            <tr className="border-b border-zinc-100">
              {["Intitule", "Type", "Montant", "Statut", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {fees?.map((f) => (
              <tr key={f.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-zinc-900">{f.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      f.type === "recurring"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-violet-50 text-violet-700 border border-violet-200"
                    }`}
                  >
                    {f.type === "recurring" ? "Recurrent" : "Exceptionnel"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                  {Number(f.amount).toLocaleString("fr-FR")} {school.currency}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-medium ${
                      f.active ? "text-emerald-600" : "text-zinc-400"
                    }`}
                  >
                    {f.active ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form
                    action={
                      toggleFeeActive.bind(null, f.id, !f.active) as () => void
                    }
                  >
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-zinc-700 hover:underline transition-colors"
                    >
                      {f.active ? "Desactiver" : "Activer"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!fees?.length && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Aucun frais defini pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
