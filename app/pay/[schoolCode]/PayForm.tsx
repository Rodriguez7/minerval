"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Telecom } from "@/lib/types";
import { TELECOM_LABELS } from "@/lib/types";
import { useLocale } from "@/lib/i18n/client";
import { getPaymentsCopy } from "@/lib/i18n/copy/payments";
import { formatMoney } from "@/lib/i18n/format";
import { localizeHref } from "@/lib/i18n/config";

interface Props {
  studentId: string;
  amountDue: number;
  paymentToken: string;
  currency?: string;
}

export function PayForm({ studentId, amountDue, paymentToken, currency = "FC" }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const copy = getPaymentsCopy(locale);
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
        setError(copy.sharedForm.errors.paymentInProgress);
      } else if (res.status === 429) {
        setError(copy.sharedForm.errors.tooManyAttempts);
      } else if (!res.ok) {
        setError(copy.sharedForm.errors.paymentFailed);
      } else {
        router.push(
          localizeHref(locale, `/pay/receipt?ref=${data.payment_request_id}`)
        );
      }
    } catch {
      setError(copy.sharedForm.errors.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{copy.sharedForm.providerLabel}</label>
        <select
          value={telecom}
          onChange={(e) => setTelecom(e.target.value as Telecom)}
          required
          className="w-full border rounded-lg px-3 py-2 bg-white"
        >
          <option value="">{copy.sharedForm.providerPlaceholder}</option>
          {(Object.entries(TELECOM_LABELS) as [Telecom, string][]).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{copy.sharedForm.numberLabel}</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={copy.sharedForm.phonePlaceholder}
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
        {loading
          ? copy.sharedForm.processing
          : `${copy.sharedForm.payButtonLabel} ${formatMoney(amountDue, currency, locale)}`}
      </button>
    </form>
  );
}
