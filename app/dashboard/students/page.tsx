export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";
import { addStudent } from "./actions";
import { CsvImportForm } from "./CsvImportForm";
import { BulkFeeForm } from "./BulkFeeForm";
import { getClassSuggestions, isUniversityOnly } from "@/lib/congo-education";
import { clampPage, getPageRange, parsePage } from "@/lib/pagination";
import { Pagination } from "../Pagination";

const STUDENTS_PAGE_SIZE = 50;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { school, plan } = await getTenantContext();
  const classSuggestions = getClassSuggestions(school.education_levels);
  const universityOnly = isUniversityOnly(school.education_levels);
  const learnerSingular = universityOnly ? "étudiant" : "élève";
  const learnerPlural = universityOnly ? "étudiants" : "élèves";
  const classLabel = universityOnly ? "Promotion / auditoire" : "Classe / promotion";
  const resolvedSearchParams = await searchParams;

  const supabase = await createSSRClient();
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", school.id);
  const totalStudents = count ?? 0;
  const page = clampPage(
    parsePage(resolvedSearchParams.page),
    totalStudents,
    STUDENTS_PAGE_SIZE
  );
  const { from, to } = getPageRange(page, STUDENTS_PAGE_SIZE);
  const { data: students } = await supabase
    .from("students")
    .select("id, external_id, full_name, class_name, amount_due, created_at")
    .eq("school_id", school.id)
    .order("full_name")
    .range(from, to);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 capitalize">{learnerPlural}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gérez les {learnerPlural} inscrits et leurs soldes de frais
        </p>
      </div>

      {/* Add student */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Ajouter un {learnerSingular}</h2>
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
              {classLabel}
            </label>
            <input
              name="class_name"
              list="congolese-class-suggestions"
              placeholder={universityOnly ? "ex. Licence 2 Économie" : "ex. 5e Primaire A"}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
            <datalist id="congolese-class-suggestions">
              {classSuggestions.map((className) => (
                <option key={className} value={className} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Montant dû <span className="text-red-500">*</span>
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
              Ajouter {universityOnly ? "l'étudiant" : "l'élève"}
            </button>
          </div>
        </form>
      </div>

      {/* CSV import */}
      <CsvImportForm educationLevels={school.education_levels} />

      {/* Bulk fee update */}
      <BulkFeeForm canBulkOps={plan.can_bulk_ops} />

      {/* Student list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            Tous les {learnerPlural}
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {totalStudents}
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {["Nom", "ID", classLabel, "Montant dû", "Ajouté le"].map((h) => (
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
              <p className="text-sm text-zinc-400">Aucun {learnerSingular} pour le moment. Ajoutez-en un ci-dessus ou importez un CSV.</p>
            </div>
          )}
        </div>
        <Pagination
          basePath="/dashboard/students"
          page={page}
          pageSize={STUDENTS_PAGE_SIZE}
          searchParams={resolvedSearchParams}
          totalItems={totalStudents}
        />
      </div>
    </div>
  );
}
