"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolvePayoutForm({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(resolution: "completed" | "failed") {
    const action = resolution === "completed" ? "confirmer comme envoyé" : "confirmer comme échoué";
    if (!window.confirm(`Vérification SerdiPay effectuée : ${action} ?`)) return;

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
        setError(data.error ?? "La résolution a échoué.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-64 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-medium text-blue-900">Résolution après vérification SerdiPay</p>
      <input
        value={transactionId}
        onChange={(event) => setTransactionId(event.target.value)}
        placeholder="ID transaction (obligatoire si envoyé)"
        className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs"
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Preuve ou résultat de la vérification (10 caractères minimum)"
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
          Confirmé envoyé
        </button>
        <button
          type="button"
          disabled={loading || note.trim().length < 10}
          onClick={() => resolve("failed")}
          className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Confirmé échoué
        </button>
      </div>
    </div>
  );
}
