"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolvePayoutForm({ payoutId, locale }: { payoutId: string; locale: "fr" | "en" }) {
  const fr = locale === "fr";
  const router = useRouter();
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(resolution: "completed" | "failed") {
    const action = resolution === "completed"
      ? fr ? "confirmer comme envoyé" : "mark as sent"
      : fr ? "confirmer comme échoué" : "mark as failed";
    if (!window.confirm(fr ? `Vérification SerdiPay effectuée : ${action} ?` : `SerdiPay review completed: ${action}?`)) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payouts/${payoutId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resolution,
          note,
          transaction_id: transactionId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? (fr ? "La résolution a échoué." : "Resolution failed."));
        return;
      }
      router.refresh();
    } catch {
      setError(fr ? "Erreur réseau. Réessayez." : "Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-64 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-medium text-blue-900">
        {fr ? "Résolution après vérification SerdiPay" : "Resolve after SerdiPay review"}
      </p>
      <input
        value={transactionId}
        onChange={(event) => setTransactionId(event.target.value)}
        placeholder={fr ? "ID de transaction (obligatoire si envoyé)" : "Transaction ID (required when sent)"}
        className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs"
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={fr ? "Preuve ou résultat de la vérification (10 caractères minimum)" : "Review evidence or result (10 characters minimum)"}
        rows={2}
        className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs"
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading || note.trim().length < 10 || !transactionId.trim()}
          onClick={() => resolve("completed")}
          className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {fr ? "Confirmer l’envoi" : "Confirm sent"}
        </button>
        <button
          type="button"
          disabled={loading || note.trim().length < 10}
          onClick={() => resolve("failed")}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {fr ? "Confirmer l’échec" : "Confirm failed"}
        </button>
      </div>
    </div>
  );
}
