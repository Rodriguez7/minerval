export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";
import { addStudent } from "./actions";
import { CsvImportForm } from "./CsvImportForm";
import { BulkFeeForm } from "./BulkFeeForm";

export default async function StudentsPage() {
  const { school, plan } = await getTenantContext();

  const supabase = await createSSRClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, external_id, full_name, class_name, amount_due, created_at")
    .eq("school_id", school.id)
    .order("full_name")
    .limit(200);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Eleves</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gere les eleves inscrits et leurs soldes de frais
        </p>
      </div>

      {/* Add student */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Ajouter un eleve</h2>
        <form
          action={addStudent.bind(null, null) as (formData: FormData) => void}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              name="full_name"
              placeholder="ex. Jean-Pierre Kabila"
              required
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Classe
            </label>
            <input
              name="class_name"
              placeholder="ex. 5eme A"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Montant du <span className="text-red-500">*</span>
            </label>
            <input
              name="amount_due"
              type="number"
              min="0"
              step="0.01"
              placeholder={`0.00 ${school.currency}`}
              required
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="col-span-1 md:col-span-3">
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              Ajouter l&apos;eleve
            </button>
          </div>
        </form>
      </div>

      {/* CSV import */}
      <CsvImportForm />

      {/* Bulk fee update */}
      <BulkFeeForm canBulkOps={plan.can_bulk_ops} />

      {/* Student list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            Tous les eleves
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {students?.length ?? 0}
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Nom", "ID", "Classe", "Montant du", "Ajoute le"].map((h) => (
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
              {students?.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">{s.external_id}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{s.class_name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    <span className={s.amount_due > 0 ? "font-semibold text-zinc-900" : "text-zinc-400"}>
                      {Number(s.amount_due).toLocaleString("fr-FR")} {school.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students?.length && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">Aucun eleve pour le moment. Ajoutez-en un ci-dessus ou importez un CSV.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
