"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  computePayoutFee,
  MIN_PAYOUT_REQUEST_AMOUNT,
  PAYOUT_FEE_BPS,
} from "@/lib/payout-fee";
import { normalizeDrcMobilePhone } from "@/lib/phone";
import { useLocale } from "@/lib/i18n/client";

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
  const fr = useLocale() === "fr";
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [telecom, setTelecom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountNum = Number(amount);
  const { feeAmount, netAmount } = computePayoutFee(Number.isFinite(amountNum) ? amountNum : 0);
  const isInvalid =
    !amount ||
    !phone ||
    !telecom ||
    amountNum < MIN_PAYOUT_REQUEST_AMOUNT ||
    amountNum > availableBalance;

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
        setError(data.error ?? (fr ? "La demande de retrait a échoué." : "Withdrawal request failed."));
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
        {fr ? "Demande de retrait envoyée. Vous recevrez un e-mail une fois traitée." : "Withdrawal request sent. You will receive an email when it is processed."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold text-sm">{fr ? "Demander un retrait" : "Request withdrawal"}</h2>

      <p className="text-xs text-gray-500">
        {fr ? "Solde disponible" : "Available balance"} : {availableBalance.toLocaleString(fr ? "fr-FR" : "en-US")} {currency}
      </p>

      <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1">
        <div className="flex justify-between">
          <span>Commission Minerval ({PAYOUT_FEE_BPS / 100}%)</span>
          <span>− {feeAmount.toLocaleString("fr-FR")} {currency}</span>
        </div>
        <div className="flex justify-between font-semibold text-zinc-900">
          <span>{fr ? "Montant envoyé à l’école" : "Amount sent to school"}</span>
          <span>{netAmount.toLocaleString("fr-FR")} {currency}</span>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{fr ? "Montant" : "Amount"} ({currency})</label>
        <input
          type="number"
          min={MIN_PAYOUT_REQUEST_AMOUNT}
          max={availableBalance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder={`${fr ? "Minimum" : "Minimum"} ${MIN_PAYOUT_REQUEST_AMOUNT.toLocaleString(fr ? "fr-FR" : "en-US")}`}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{fr ? "Téléphone Mobile Money" : "Mobile Money phone"}</label>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => {
            const normalized = normalizeDrcMobilePhone(phone);
            if (normalized) setPhone(`+${normalized}`);
          }}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="0812345678 ou +243812345678"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">{fr ? "Opérateur" : "Operator"}</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          required
        >
          <option value="">{fr ? "Choisir un opérateur" : "Choose an operator"}</option>
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
        {loading ? fr ? "Envoi…" : "Sending…" : fr ? "Demander un retrait" : "Request withdrawal"}
      </button>
    </form>
  );
}
