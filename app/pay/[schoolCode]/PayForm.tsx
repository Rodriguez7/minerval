"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";

interface Props {
  studentId: string;
  amountDue: number;
  paymentToken: string;
}

export function PayForm({ studentId, amountDue, paymentToken }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState<Telecom | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!telecom) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          phone,
          telecom,
          payment_token: paymentToken,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError("A payment is already in progress. Please wait 2 minutes and try again.");
      } else if (res.status === 429) {
        setError(data.error || "Too many attempts. Please try again later.");
      } else if (!res.ok) {
        setError(data.error || "Payment failed. Please try again.");
      } else {
        router.push(`/pay/receipt?ref=${data.payment_request_id}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Mobile Money Provider</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value as Telecom)}
          required
          className="w-full border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Select provider…</option>
          {(Object.entries(TELECOM_LABELS) as [Telecom, string][]).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Mobile Money Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="243812345678"
          required
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !telecom}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
      >
        {loading ? "Processing…" : `Pay ${amountDue.toLocaleString()} FC`}
      </button>
    </form>
  );
}
