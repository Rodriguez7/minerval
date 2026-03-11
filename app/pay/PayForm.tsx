"use client";
import { useState } from "react";
import type { StudentInfo, Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";

export function PayForm({ student }: { student: StudentInfo }) {
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState<Telecom | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <p className="font-semibold text-green-700">Payment initiated</p>
        <p className="text-sm text-green-600 mt-1">
          You will receive a confirmation prompt on your phone shortly.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!telecom) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: student.student_id, phone, telecom }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError("A payment is already in progress for this number. Please wait 2 minutes and try again.");
      } else if (!res.ok) {
        setError(data.error || "Payment failed. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Mobile Money Provider</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value as Telecom)}
          required
          className="w-full border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Select provider...</option>
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
          placeholder="e.g. 243812345678"
          required
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !telecom}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? "Processing..." : `Pay ${student.amount_due.toLocaleString()} FC`}
      </button>
    </form>
  );
}
