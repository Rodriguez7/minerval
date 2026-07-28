"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/i18n/config";
import type { VerificationDocument } from "@/lib/verification-documents";

const LABELS: Record<string, { fr: string; en: string }> = {
  registration_certificate: {
    fr: "Registre de commerce ou preuve d’immatriculation",
    en: "Business register or registration certificate",
  },
  tax_certificate: {
    fr: "Numéro d’impôt ou attestation fiscale",
    en: "Tax number or tax certificate",
  },
  authorization: {
    fr: "Agrément ou autorisation de fonctionnement",
    en: "Operating licence or authorization",
  },
  representative_id: {
    fr: "Pièce d’identité du responsable légal",
    en: "Legal representative’s identity document",
  },
  other: { fr: "Autre justificatif", en: "Other supporting document" },
};

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} Mo`;
}

export function VerificationDocumentsForm({
  documents,
  canManage,
  locale,
}: {
  documents: VerificationDocument[];
  canManage: boolean;
  locale: AppLocale;
}) {
  const fr = locale === "fr";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState("registration_certificate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError(fr ? "Sélectionnez un document." : "Select a document.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("documentType", documentType);
    formData.set("document", file);
    try {
      const response = await fetch("/api/dashboard/school/verification-documents", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(fr ? "Document ajouté." : "Document uploaded.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : fr
            ? "L’envoi a échoué."
            : "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/dashboard/school/verification-documents?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSuccess(fr ? "Document supprimé." : "Document deleted.");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : fr
            ? "La suppression a échoué."
            : "Delete failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-zinc-100 pt-5">
      <h3 className="text-sm font-semibold text-zinc-900">
        {fr ? "Documents de vérification" : "Verification documents"}
      </h3>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        {fr
          ? "Ajoutez les documents officiels de l’établissement. Ils seront consultés uniquement pendant la vérification."
          : "Upload the school’s official documents. They will only be used during verification."}
      </p>

      <div className="mt-3 space-y-2">
        {documents.map((document) => (
          <div
            key={document.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-900">
                {LABELS[document.document_type]?.[locale] ?? document.document_type}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {document.file_name} · {formatSize(document.size_bytes)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {document.url && (
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 no-underline hover:bg-zinc-50"
                >
                  {fr ? "Ouvrir" : "Open"}
                </a>
              )}
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(document.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {fr ? "Supprimer" : "Delete"}
                </button>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
            {fr ? "Aucun document ajouté." : "No documents uploaded."}
          </p>
        )}
      </div>

      {canManage && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-medium text-zinc-600">
            {fr ? "Type de document" : "Document type"}
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              disabled={busy}
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              {Object.entries(LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label[locale]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-600">
            {fr ? "Fichier" : "File"}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy}
              className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
          </label>
          <button
            type="button"
            onClick={upload}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? (fr ? "Traitement…" : "Processing…") : fr ? "Ajouter" : "Add"}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-400">
        {fr ? "PDF, JPEG ou PNG — 10 Mo maximum par fichier." : "PDF, JPEG, or PNG — 10 MB maximum per file."}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-3 text-sm text-emerald-700">{success}</p>}
    </div>
  );
}
