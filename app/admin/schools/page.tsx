import { getRequestLocale } from "@/lib/i18n/server";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { getAdminClient } from "@/lib/supabase";
import type { SchoolVerificationStatus } from "@/lib/types";
import { signVerificationDocuments } from "@/lib/verification-documents";
import { VerificationReviewForm } from "./VerificationReviewForm";

export const dynamic = "force-dynamic";

const FILTERS = ["pending", "rejected", "verified", "all"] as const;

export default async function AdminSchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = await getRequestLocale();
  const fr = locale === "fr";
  const requestedFilter = (await searchParams).status;
  const filter = FILTERS.includes(requestedFilter as (typeof FILTERS)[number])
    ? (requestedFilter as (typeof FILTERS)[number])
    : "pending";
  const admin = getAdminClient();

  let schoolQuery = admin
    .from("schools")
    .select(
      "id,name,code,admin_email,currency,status,verification_status,legal_name,registration_number,school_address,director_name,director_phone,payout_account_name,payout_account_phone,verification_submitted_at,verification_reviewed_at,verification_rejection_reason"
    )
    .in("verification_status", ["pending", "rejected", "verified"])
    .order("verification_submitted_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (filter !== "all") {
    schoolQuery = schoolQuery.eq("verification_status", filter);
  }

  const [{ data: schools }, countResults] = await Promise.all([
    schoolQuery,
    Promise.all(
      ["pending", "rejected", "verified"].map((status) =>
        admin
          .from("schools")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", status)
      )
    ),
  ]);
  const counts = {
    pending: countResults[0].count ?? 0,
    rejected: countResults[1].count ?? 0,
    verified: countResults[2].count ?? 0,
  };

  const schoolIds = (schools ?? []).map((school) => school.id);
  const { data: documentRows } = schoolIds.length
    ? await admin
        .from("school_verification_documents")
        .select("id,school_id,document_type,file_name,storage_path,mime_type,size_bytes,created_at")
        .in("school_id", schoolIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const documents = await signVerificationDocuments(admin, documentRows ?? []);

  const documentLabels: Record<string, string> = fr
    ? {
        registration_certificate: "Immatriculation",
        tax_certificate: "Attestation fiscale",
        authorization: "Autorisation",
        representative_id: "Identité du responsable",
        other: "Autre document",
      }
    : {
        registration_certificate: "Registration",
        tax_certificate: "Tax certificate",
        authorization: "Authorization",
        representative_id: "Representative ID",
        other: "Other document",
      };
  const statusLabels: Record<string, string> = fr
    ? { pending: "À examiner", rejected: "Corrections demandées", verified: "Approuvé" }
    : { pending: "To review", rejected: "Changes requested", verified: "Approved" };
  const filterLabels: Record<(typeof FILTERS)[number], string> = fr
    ? { pending: "À examiner", rejected: "À corriger", verified: "Approuvés", all: "Tous" }
    : { pending: "To review", rejected: "Needs changes", verified: "Approved", all: "All" };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
          {fr ? "Établissements" : "Schools"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
          {fr ? "Dossiers de vérification" : "Verification applications"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
          {fr
            ? "Examinez les informations et les documents officiels, puis prenez une décision."
            : "Review the school information and official documents, then make a decision."}
        </p>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={fr ? "Filtres" : "Filters"}>
        {FILTERS.map((item) => {
          const count =
            item === "all"
              ? counts.pending + counts.rejected + counts.verified
              : counts[item];
          return (
            <LocalizedLink
              key={item}
              href={`/admin/schools?status=${item}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold no-underline ${
                filter === item
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {filterLabels[item]} · {count}
            </LocalizedLink>
          );
        })}
      </nav>

      <div className="grid gap-4">
        {(schools ?? []).map((school) => {
          const schoolDocuments = documents.filter(
            (document) => document.school_id === school.id
          );
          return (
            <article key={school.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-zinc-950">{school.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      school.verification_status === "verified"
                        ? "bg-emerald-50 text-emerald-700"
                        : school.verification_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      {statusLabels[school.verification_status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {school.code} · {school.currency} · {school.admin_email}
                  </p>
                </div>
                <p className="text-xs text-zinc-400">
                  {school.verification_submitted_at
                    ? new Date(school.verification_submitted_at).toLocaleString(
                        fr ? "fr-FR" : "en-US"
                      )
                    : fr
                      ? "Non soumis"
                      : "Not submitted"}
                </p>
              </div>

              <dl className="mt-5 grid gap-4 rounded-xl bg-zinc-50 p-4 text-sm sm:grid-cols-2">
                {[
                  [fr ? "Raison sociale" : "Legal name", school.legal_name],
                  [fr ? "Immatriculation" : "Registration", school.registration_number],
                  [fr ? "Adresse" : "Address", school.school_address],
                  [fr ? "Responsable légal" : "Legal representative", school.director_name],
                  [fr ? "Téléphone" : "Phone", school.director_phone],
                  [fr ? "Compte de versement" : "Payout account", school.payout_account_name],
                  [fr ? "Téléphone de versement" : "Payout phone", school.payout_account_phone],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-zinc-400">{label}</dt>
                    <dd className="mt-1 text-zinc-800">{value || "—"}</dd>
                  </div>
                ))}
              </dl>

              <section className="mt-5">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {fr ? "Documents" : "Documents"} · {schoolDocuments.length}
                </h3>
                {schoolDocuments.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {schoolDocuments.map((document) => (
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
                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {document.file_name} · {(document.size_bytes / 1024 / 1024).toFixed(1)} Mo
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-blue-700">
                          {fr ? "Consulter" : "Review"}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                    {fr
                      ? "Aucun document envoyé. L’approbation reste indisponible."
                      : "No documents uploaded. Approval remains unavailable."}
                  </p>
                )}
              </section>

              <VerificationReviewForm
                schoolId={school.id}
                status={school.verification_status as SchoolVerificationStatus}
                rejectionReason={school.verification_rejection_reason}
                canApprove={schoolDocuments.length > 0}
                locale={locale}
              />
            </article>
          );
        })}
        {(schools ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
            {fr ? "Aucun dossier dans cette catégorie." : "No applications in this category."}
          </div>
        )}
      </div>
    </div>
  );
}
