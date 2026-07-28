"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/client";

export function CloseSchoolForm({ schoolCode }: { schoolCode: string }) {
  const locale = useLocale();
  const fr = locale === "fr";
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/account/close", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, reason }),
      });
      const result = await response.json();
      if (!response.ok) {
        const counts =
          response.status === 409
            ? ` (${result.pending_payments ?? 0} paiement(s), ${result.pending_payouts ?? 0} versement(s))`
            : "";
        setError(`${result.error ?? (fr ? "La fermeture a échoué." : "Closing the school failed.")}${counts}`);
        return;
      }
      window.location.assign(`/${locale}/`);
    } catch {
      setError(fr ? "La fermeture a échoué. Vérifiez votre connexion et réessayez." : "Closing the school failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-sm font-semibold text-red-900">{fr ? "Fermer l’établissement" : "Close school"}</h2>
      <p className="mt-1 text-xs leading-5 text-red-800">
        {fr
          ? "Cette action annule l’abonnement, désactive tous les accès et bloque les nouveaux paiements. Les données financières et d’audit sont conservées. Téléchargez votre export avant de continuer."
          : "This cancels the subscription, disables all access, and blocks new payments. Financial and audit data are retained. Download your export first."}
      </p>

      <label className="mt-4 block text-xs font-medium text-red-900">
        {fr ? "Motif (facultatif)" : "Reason (optional)"}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </label>

      <label className="mt-4 block text-xs font-medium text-red-900">
        {fr ? "Saisissez" : "Enter"} <span className="font-mono">{schoolCode}</span> {fr ? "pour confirmer" : "to confirm"}
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="mt-1 block w-full rounded-lg border border-red-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
        />
      </label>

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting || confirmation !== schoolCode}
        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? fr ? "Fermeture en cours…" : "Closing…"
          : fr ? "Fermer l’établissement" : "Close school"}
      </button>
    </form>
  );
}
