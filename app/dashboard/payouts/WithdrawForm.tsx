"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TELECOM_OPTIONS = [
  { value: "AM", label: "Airtel Money" },
  { value: "OM", label: "Orange Money" },
  { value: "MP", label: "Vodacom M-Pesa" },
  { value: "AF", label: "Afrimoney" },
];

interface Props {
  availableBalance: number;
  currency: string;
}

export function WithdrawForm({ availableBalance, currency }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountNum = Number(amount);
  const isInvalid = !amount || !phone || !telecom || amountNum < 1000 || amountNum > availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/payouts/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: amountNum, phone, telecom }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "La demande de retrait a echoue");
        return;
      }

      setSuccess(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border p-4 text-sm text-green-700 bg-green-50">
        Demande de retrait envoyee. Vous recevrez un email une fois traitee.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold text-sm">Demander un retrait</h2>

      <p className="text-xs text-gray-500">
        Solde disponible : {availableBalance.toLocaleString("fr-FR")} {currency}
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium">Montant ({currency})</label>
        <input
          type="number"
          min={1000}
          max={availableBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Minimum 1 000"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Telephone Mobile Money</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="0812345678"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Operateur</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          required
        >
          <option value="">Choisir un operateur</option>
          {TELECOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isInvalid || loading}
        className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {loading ? "Envoi…" : "Demander un retrait"}
      </button>
    </form>
  );
}
