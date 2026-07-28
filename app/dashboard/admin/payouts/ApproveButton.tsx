"use client";
import { useState } from "react";

export function ApproveButton({ payoutId, locale }: { payoutId: string; locale: "fr" | "en" }) {
  const fr = locale === "fr";
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    const confirmed = window.confirm(
      fr
        ? "Confirmer ce versement réel vers le compte Mobile Money indiqué ?"
        : "Confirm this real payout to the listed Mobile Money account?"
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/approve`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? (fr ? "Échec" : "Failed"));
      }
    } catch {
      setError(fr ? "Erreur réseau" : "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <span className="text-xs text-green-600">{fr ? "Envoyé" : "Sent"}</span>;
  if (error) return <span className="text-xs text-red-600">{error}</span>;

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
    >
      {loading ? "…" : fr ? "Approuver" : "Approve"}
    </button>
  );
}
