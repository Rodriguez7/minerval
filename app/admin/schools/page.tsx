import { getRequestLocale } from "@/lib/i18n/server";
import { getAdminClient } from "@/lib/supabase";
import type { SchoolVerificationStatus } from "@/lib/types";
import { VerificationReviewForm } from "./VerificationReviewForm";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const locale = await getRequestLocale();
  const admin = getAdminClient();
  const { data: schools } = await admin
    .from("schools")
    .select(
      "id,name,code,currency,verification_status,legal_name,registration_number,school_address,director_name,director_phone,payout_account_name,payout_account_phone,verification_submitted_at,verification_rejection_reason"
    )
    .in("verification_status", ["pending", "rejected", "verified"])
    .order("verification_submitted_at", { ascending: false, nullsFirst: false })
    .limit(100);
  const schoolIds = (schools ?? []).map((school) => school.id);
  const { data: documentRows } = schoolIds.length
    ? await admin
        .from("school_verification_documents")
        .select("id,school_id,document_type,file_name,storage_path,mime_type,size_bytes,created_at")
        .in("school_id", schoolIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const documents = await Promise.all(
    (documentRows ?? []).map(async (document) => {
      const { data } = await admin.storage
        .from("school-verification-documents")
        .createSignedUrl(document.storage_path, 300);
      return { ...document, url: data?.signedUrl ?? null };
    })
  );

  const fr = locale === "fr";
  const documentLabels: Record<string, string> = fr
    ? {
        registration_certificate: "Registre de commerce ou immatriculation",
        tax_certificate: "Attestation fiscale",
        authorization: "Agrément ou autorisation",
        representative_id: "Pièce d’identité du responsable",
        other: "Autre justificatif",
      }
    : {
        registration_certificate: "Business register or registration",
        tax_certificate: "Tax certificate",
        authorization: "Licence or authorization",
        representative_id: "Representative’s identity document",
        other: "Other supporting document",
      };
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

            <section className="mt-5 border-t border-zinc-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {fr ? "Documents justificatifs" : "Supporting documents"}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {documents
                  .filter((document) => document.school_id === school.id)
                  .map((document) => (
                    <a
                      key={document.id}
                      href={document.url ?? "#"}
                      target={document.url ? "_blank" : undefined}
                      rel={document.url ? "noreferrer" : undefined}
                      aria-disabled={!document.url}
                      className="rounded-lg border border-zinc-200 p-3 text-sm no-underline hover:bg-zinc-50"
                    >
                      <span className="block font-medium text-zinc-900">
                        {documentLabels[document.document_type] ?? document.document_type}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {document.file_name} · {(document.size_bytes / 1024 / 1024).toFixed(1)} Mo
                      </span>
                    </a>
                  ))}
              </div>
              {documents.filter((document) => document.school_id === school.id).length === 0 && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {fr
                    ? "Aucun document justificatif n’a été envoyé."
                    : "No supporting documents have been uploaded."}
                </p>
              )}
            </section>

            <VerificationReviewForm
              schoolId={school.id}
              status={school.verification_status as SchoolVerificationStatus}
              rejectionReason={school.verification_rejection_reason}
              locale={locale}
            />
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
