"use client";

import { useActionState } from "react";
import { verifyMfaChallenge } from "@/app/actions/mfa";
import type { AppLocale } from "@/lib/i18n/config";

export function MfaChallengeForm({ factorId, locale, next }: { factorId: string; locale: AppLocale; next: string }) {
  const french = locale === "fr";
  const [state, action, pending] = useActionState(verifyMfaChallenge, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-zinc-800">
        {french ? "Code a 6 chiffres" : "6-digit code"}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-3 text-center text-xl tracking-[0.35em]" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {pending ? (french ? "Verification..." : "Verifying...") : (french ? "Verifier et continuer" : "Verify and continue")}
      </button>
    </form>
  );
}
