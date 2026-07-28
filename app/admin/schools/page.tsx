import { reviewSchoolVerification } from "@/app/actions/settings";
import { getRequestLocale } from "@/lib/i18n/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const locale = await getRequestLocale();
  const { data: schools } = await getAdminClient()
    .from("schools")
    .select(
      "id,name,code,currency,verification_status,legal_name,registration_number,school_address,director_name,director_phone,payout_account_name,payout_account_phone,verification_submitted_at,verification_rejection_reason"
    )
    .in("verification_status", ["pending", "rejected", "verified"])
    .order("verification_submitted_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const fr = locale === "fr";
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {fr ? "Administration interne" : "Internal administration"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Vérification des établissements" : "School verification"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fr
            ? "Examinez le profil légal avant d’activer les rappels WhatsApp et les versements."
            : "Review the legal profile before enabling WhatsApp reminders and payouts."}
        </p>
      </div>

      <div className="grid gap-4">
        {(schools ?? []).map((school) => (
          <article key={school.id} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-zinc-950">{school.name}</h2>
                <p className="text-sm text-zinc-500">
                  {school.code} · {school.currency} · {school.verification_status}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                {school.verification_submitted_at
                  ? new Date(school.verification_submitted_at).toLocaleString(fr ? "fr-FR" : "en-US")
                  : fr ? "Non soumise" : "Not submitted"}
              </span>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {[
                [fr ? "Raison sociale" : "Legal name", school.legal_name],
                [fr ? "Immatriculation" : "Registration", school.registration_number],
                [fr ? "Adresse" : "Address", school.school_address],
                [fr ? "Responsable" : "Director", school.director_name],
                [fr ? "Téléphone" : "Phone", school.director_phone],
                [fr ? "Compte de versement" : "Payout account", school.payout_account_name],
                [fr ? "Téléphone de versement" : "Payout phone", school.payout_account_phone],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 text-zinc-800">{value || "—"}</dd>
                </div>
              ))}
            </dl>

            <form
              action={async (formData: FormData) => {
                "use server";
                await reviewSchoolVerification(formData);
              }}
              className="mt-5 space-y-3 border-t border-zinc-100 pt-4"
            >
              <input type="hidden" name="schoolId" value={school.id} />
              <label className="block text-xs font-medium text-zinc-600">
                {fr ? "Note de vérification" : "Review note"}
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={school.verification_rejection_reason ?? ""}
                  className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  name="decision"
                  value="verified"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {fr ? "Approuver" : "Approve"}
                </button>
                <button
                  name="decision"
                  value="rejected"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  {fr ? "Demander des corrections" : "Request changes"}
                </button>
              </div>
            </form>
          </article>
        ))}
        {(schools ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            {fr ? "Aucun dossier de vérification." : "No verification records."}
          </div>
        )}
      </div>
    </div>
  );
}
