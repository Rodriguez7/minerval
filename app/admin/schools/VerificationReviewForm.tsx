"use client";

import { useActionState } from "react";
import { reviewSchoolVerification } from "@/app/actions/settings";
import type { AppLocale } from "@/lib/i18n/config";
import type { SchoolVerificationStatus } from "@/lib/types";

export function VerificationReviewForm({
  schoolId,
  status,
  rejectionReason,
  locale,
}: {
  schoolId: string;
  status: SchoolVerificationStatus;
  rejectionReason: string | null;
  locale: AppLocale;
}) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(
    reviewSchoolVerification,
    undefined
  );

  return (
    <form action={action} className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
      <input type="hidden" name="schoolId" value={schoolId} />
      <label className="block text-xs font-medium text-zinc-600">
        {fr ? "Motif ou note de vérification" : "Reason or review note"}
        <textarea
          name="note"
          rows={3}
          defaultValue={rejectionReason ?? ""}
          placeholder={
            fr
              ? "Obligatoire lorsque vous demandez des corrections."
              : "Required when requesting changes."
          }
          className="mt-1 block w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-zinc-500">
        {fr
          ? "La décision apparaît immédiatement dans les paramètres de l’établissement. Un e-mail est également envoyé au propriétaire."
          : "The decision appears immediately in the school’s settings. The owner is also notified by email."}
      </p>
      {state?.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          name="decision"
          value="verified"
          disabled={pending || status === "verified"}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? fr
              ? "Enregistrement…"
              : "Saving…"
            : status === "verified"
              ? fr
                ? "Déjà approuvé"
                : "Already approved"
              : fr
                ? "Approuver"
                : "Approve"}
        </button>
        <button
          name="decision"
          value="rejected"
          disabled={pending}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fr ? "Demander des corrections" : "Request changes"}
        </button>
      </div>
    </form>
  );
}
