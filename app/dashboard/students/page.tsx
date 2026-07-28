export const dynamic = "force-dynamic";

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";
import {
  addStudent,
  setStudentGuardian,
  setStudentReminderPause,
} from "./actions";
import { CsvImportForm } from "./CsvImportForm";
import { BulkFeeForm } from "./BulkFeeForm";
import { getClassSuggestions, isUniversityOnly } from "@/lib/congo-education";
import { clampPage, getPageRange, parsePage } from "@/lib/pagination";
import { Pagination } from "../Pagination";
import { getRequestLocale } from "@/lib/i18n/server";

const STUDENTS_PAGE_SIZE = 50;

type StudentRow = {
  id: string;
  external_id: string;
  full_name: string;
  class_name: string | null;
  amount_due: number;
  balance_due_at: string | null;
  reminders_paused_until: string | null;
  reminder_stop_reason: string | null;
  created_at: string;
  student_guardians: Array<{
    relationship: "parent" | "guardian" | "payer";
    guardians: {
      full_name: string;
      whatsapp_phone: string;
      whatsapp_opted_out_at: string | null;
    } | null;
  }>;
};

function maskPhone(phone: string) {
  return phone.length > 7 ? `${phone.slice(0, 5)}•••${phone.slice(-3)}` : phone;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const { school, plan } = await getTenantContext();
  const classSuggestions = getClassSuggestions(school.education_levels);
  const universityOnly = isUniversityOnly(school.education_levels);
  const learnerSingular = fr ? (universityOnly ? "étudiant" : "élève") : "student";
  const learnerPlural = fr ? (universityOnly ? "étudiants" : "élèves") : "students";
  const classLabel = fr
    ? universityOnly ? "Promotion / auditoire" : "Classe / promotion"
    : universityOnly ? "Cohort / lecture group" : "Class / grade";
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
  const { data: studentData } = await supabase
    .from("students")
    .select(`
      id, external_id, full_name, class_name, amount_due, balance_due_at,
      reminders_paused_until, reminder_stop_reason, created_at,
      student_guardians!left (
        relationship,
        guardians!inner (full_name, whatsapp_phone, whatsapp_opted_out_at)
      )
    `)
    .eq("school_id", school.id)
    .order("full_name")
    .range(from, to);
  const students = (studentData ?? []) as unknown as StudentRow[];
  const { data: recentMessages } = students.length
    ? await supabase
        .from("whatsapp_messages")
        .select("student_id, status, scheduled_for, created_at")
        .in("student_id", students.map((student) => student.id))
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const latestMessageByStudent = new Map<
    string,
    { status: string; scheduled_for: string }
  >();
  for (const message of recentMessages ?? []) {
    if (!latestMessageByStudent.has(message.student_id)) {
      latestMessageByStudent.set(message.student_id, message);
    }
  }
  const unreachableStudents = students.filter((student) => {
    const guardian = student.student_guardians?.[0]?.guardians;
    return (
      !guardian ||
      Boolean(guardian.whatsapp_opted_out_at) ||
      latestMessageByStudent.get(student.id)?.status === "failed"
    );
  });
  const studentsWithoutGuardian = students.filter(
    (student) => !student.student_guardians?.[0]?.guardians
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 capitalize">{learnerPlural}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {fr
            ? `Gérez les ${learnerPlural} inscrits et leurs soldes de frais`
            : "Manage enrolled students and their outstanding fees"}
        </p>
      </div>

      {/* Add student */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">
          {fr ? `Ajouter un ${learnerSingular}` : "Add a student"}
        </h2>
        <form
          action={addStudent.bind(null, null) as (formData: FormData) => void}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Nom complet" : "Full name"} <span className="text-red-500">*</span>
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
              {fr ? "Montant dû" : "Amount due"} <span className="text-red-500">*</span>
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Échéance" : "Due date"}
            </label>
            <input
              name="balance_due_at"
              type="date"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
            <p className="text-xs text-zinc-400">
              {fr ? "Requise lorsque le montant dû est supérieur à zéro." : "Required when the amount due is greater than zéro."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Parent / responsable" : "Parent / guardian"} <span className="text-red-500">*</span>
            </label>
            <input
              name="guardian_name"
              placeholder="ex. Chantal Kabila"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "WhatsApp du responsable" : "Guardian WhatsApp"} <span className="text-red-500">*</span>
            </label>
            <input
              name="guardian_whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812345678 ou +243812345678"
              required
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {fr ? "Lien avec l’apprenant" : "Relationship to student"}
            </label>
            <select
              name="guardian_relationship"
              defaultValue="parent"
              required
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            >
              <option value="parent">Parent</option>
              <option value="guardian">{fr ? "Tuteur / responsable" : "Guardian"}</option>
              <option value="payer">{fr ? "Payeur désigné" : "Designated payer"}</option>
            </select>
          </div>
          <input type="hidden" name="guardian_locale" value="fr" />
          <label className="col-span-1 md:col-span-3 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
            <input name="whatsapp_consent" type="checkbox" required className="mt-0.5" />
            <span>
              {fr
                ? "Je confirme que ce responsable a accepté de recevoir sur WhatsApp les rappels administratifs liés aux frais scolaires."
                : "I confirm that this guardian agreed to receive administrative school-fee reminders on WhatsApp."}
            </span>
          </label>
          <div className="col-span-1 md:col-span-3">
            <button
              type="submit"
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 active:scale-[0.98] transition-all"
            >
              {fr ? `Ajouter ${universityOnly ? "l’étudiant" : "l’élève"}` : "Add student"}
            </button>
          </div>
        </form>
      </div>

      {/* CSV import */}
      <CsvImportForm educationLevels={school.education_levels} />

      {/* Bulk fee update */}
      <BulkFeeForm canBulkOps={plan.can_bulk_ops} />

      {studentsWithoutGuardian.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? "Compléter un responsable existant" : "Add a guardian to an existing student"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {fr
              ? "Les anciens dossiers restent exclus des rappels tant qu’un responsable consentant n’est pas enregistré."
              : "Existing records remain excluded from reminders until a consenting guardian is added."}
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              await setStudentGuardian(formData);
            }}
            className="mt-4 grid gap-3 md:grid-cols-3"
          >
            <select name="studentId" required className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white">
              <option value="">{fr ? "Choisir l’apprenant" : "Choose a student"}</option>
              {studentsWithoutGuardian.map((student) => (
                <option key={student.id} value={student.id}>{student.full_name} — {student.external_id}</option>
              ))}
            </select>
            <input name="guardianName" required placeholder={fr ? "Nom du responsable" : "Guardian name"} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <input name="guardianWhatsapp" required type="tel" placeholder="WhatsApp: 0812345678" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
            <select name="guardianRelationship" defaultValue="parent" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm bg-white">
              <option value="parent">Parent</option>
              <option value="guardian">{fr ? "Tuteur / responsable" : "Guardian"}</option>
              <option value="payer">{fr ? "Payeur désigné" : "Designated payer"}</option>
            </select>
            <input type="hidden" name="guardianLocale" value="fr" />
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input name="whatsappConsent" type="checkbox" required />{" "}
              {fr ? "Consentement WhatsApp confirmé" : "WhatsApp consent confirmed"}
            </label>
            <button type="submit" className="md:col-span-3 justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              {fr ? "Enregistrer le responsable" : "Save guardian"}
            </button>
          </form>
        </div>
      )}

      {unreachableStudents.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            {fr ? "Parents non joints" : "Unreachable guardians"}
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            {fr
              ? `${unreachableStudents.length} apprenant${unreachableStudents.length > 1 ? "s" : ""} sur cette page nécessite une vérification du numéro ou du consentement WhatsApp.`
              : `${unreachableStudents.length} student${unreachableStudents.length > 1 ? "s" : ""} on this page needs a phone or consent review.`}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {unreachableStudents.slice(0, 5).map((student) => student.full_name).join(", ")}
            {unreachableStudents.length > 5 ? "…" : ""}
          </p>
        </div>
      )}

      {/* Student list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            {fr ? `Tous les ${learnerPlural}` : "All students"}
            <span className="ml-2 text-xs font-normal text-zinc-400">
              {totalStudents}
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="border-b border-zinc-100">
                {(fr
                  ? ["Nom", "ID", classLabel, "Responsable", "WhatsApp", "Montant dû", "Échéance", "Rappels", "Ajouté le"]
                  : ["Name", "ID", classLabel, "Guardian", "WhatsApp", "Amount due", "Due date", "Reminders", "Added"]
                ).map((h) => (
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
                  {(() => {
                    const primary = s.student_guardians?.[0];
                    const guardian = primary?.guardians;
                    const latestMessage = latestMessageByStudent.get(s.id);
                    return (
                      <>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">{s.external_id}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{s.class_name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {guardian?.full_name ?? (fr ? "À compléter" : "Incomplete")}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500 font-mono">
                    {guardian ? maskPhone(guardian.whatsapp_phone) : "—"}
                    {guardian?.whatsapp_opted_out_at && (
                      <span className="ml-2 text-xs text-red-600">{fr ? "désabonné" : "opted out"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    <span className={s.amount_due > 0 ? "font-semibold text-zinc-900" : "text-zinc-400"}>
                      {Number(s.amount_due).toLocaleString("fr-FR")} {school.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {s.balance_due_at
                      ? new Date(s.balance_due_at).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {s.reminder_stop_reason === "paid" ? (
                      <span className="text-emerald-700">{fr ? "arrêtés — payé" : "stopped — paid"}</span>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500">
                          {latestMessage
                            ? latestMessage.status
                            : s.amount_due > 0
                              ? fr ? "à planifier" : "to schedule"
                              : fr ? "aucun" : "none"}
                        </p>
                      <form action={async (formData: FormData) => {
                        "use server";
                        await setStudentReminderPause(formData);
                      }}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <input
                          type="hidden"
                          name="mode"
                          value={s.reminders_paused_until ? "resume" : "pause"}
                        />
                        <button type="submit" className="text-xs text-blue-700 hover:underline whitespace-nowrap">
                          {s.reminders_paused_until
                            ? fr ? "Reprendre" : "Resume"
                            : fr ? "Pauser 7 jours" : "Pause for 7 days"}
                        </button>
                      </form>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
          {!students?.length && (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">
                {fr
                  ? `Aucun ${learnerSingular} pour le moment. Ajoutez-en un ci-dessus ou importez un CSV.`
                  : "No students yet. Add one above or import a CSV file."}
              </p>
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
