"use client";
import { useState } from "react";

export function ApproveButton({ payoutId }: { payoutId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/approve`, { method: "POST" });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Echec");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <span className="text-xs text-green-600">Envoye</span>;
  if (error) return <span className="text-xs text-red-600">{error}</span>;

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-40"
    >
      {loading ? "…" : "Approuver"}
    </button>
  );
}
