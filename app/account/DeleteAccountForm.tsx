"use client";

import { useState } from "react";
import type { AppLocale } from "@/lib/i18n/config";

export function DeleteAccountForm({ email, locale }: { email: string; locale: AppLocale }) {
  const french = locale === "fr";
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        const schools = Array.isArray(result.schools) ? ` (${result.schools.join(", ")})` : "";
        setError(`${result.error ?? (french ? "La suppression a echoue." : "Deletion failed.")}${schools}`);
        return;
      }
      window.location.assign(`/${locale}/?account_deleted=1`);
    } catch {
      setError(french ? "Erreur reseau. Reessayez." : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-red-950">
        {french ? "Adresse email de confirmation" : "Confirmation email"}
        <span className="mt-1 block text-xs font-normal text-red-800">
          {french ? "Saisissez exactement" : "Enter exactly"} <span className="font-mono">{email}</span>
        </span>
        <input
          type="email"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          className="mt-2 block w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </label>
      <label className="block text-sm font-medium text-red-950">
        {french ? "Mot de passe actuel" : "Current password"}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-2 block w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting || confirmation !== email || password.length < 6}
        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? (french ? "Suppression en cours..." : "Deleting...")
          : (french ? "Supprimer mon compte personnel" : "Delete my personal account")}
      </button>
    </form>
  );
}
