"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  beginTotpEnrollment,
  disableTotp,
  verifyTotpEnrollment,
} from "@/app/actions/mfa";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import type { AppLocale } from "@/lib/i18n/config";

export function MfaSetup({
  locale,
  factorId,
  currentLevel,
}: {
  locale: AppLocale;
  factorId?: string;
  currentLevel: "aal1" | "aal2" | null;
}) {
  const french = locale === "fr";
  const [enrollState, enrollAction, enrolling] = useActionState(beginTotpEnrollment, null);
  const [verifyState, verifyAction, verifying] = useActionState(verifyTotpEnrollment, null);
  const [disableState, disableAction, disabling] = useActionState(disableTotp, null);

  if (verifyState?.success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">{french ? "MFA active" : "MFA enabled"}</p>
        <p className="mt-1">{french ? "Votre compte est maintenant protege par votre application d'authentification." : "Your account is now protected by your authenticator app."}</p>
        <LocalizedLink href="/dashboard" className="mt-3 inline-block font-medium text-emerald-800 underline">
          {french ? "Continuer vers le tableau de bord" : "Continue to dashboard"}
        </LocalizedLink>
      </div>
    );
  }

  if (disableState?.success) {
    return <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">{french ? "Le MFA a ete desactive." : "MFA has been disabled."}</p>;
  }

  if (factorId || enrollState?.alreadyEnabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">{french ? "Application d'authentification active" : "Authenticator app enabled"}</p>
          <p className="mt-1">{french ? "Un code sera demande lors de vos nouvelles connexions." : "A code will be required on new sign-ins."}</p>
        </div>
        {factorId && currentLevel !== "aal2" ? (
          <LocalizedLink href={`/mfa/verify?next=/${locale}/account/security`} className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {french ? "Verifier avant de modifier" : "Verify before making changes"}
          </LocalizedLink>
        ) : factorId ? (
          <form action={disableAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="factorId" value={factorId} />
            {disableState?.error && <p role="alert" className="mb-3 text-sm text-red-700">{disableState.error}</p>}
            <button type="submit" disabled={disabling} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
              {disabling ? (french ? "Desactivation..." : "Disabling...") : (french ? "Desactiver le MFA" : "Disable MFA")}
            </button>
          </form>
        ) : null}
      </div>
    );
  }

  if (enrollState?.factorId && enrollState.qrCode && enrollState.secret) {
    return (
      <div className="space-y-5">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          <li>{french ? "Ouvrez Google Authenticator, Microsoft Authenticator ou 1Password." : "Open Google Authenticator, Microsoft Authenticator, or 1Password."}</li>
          <li>{french ? "Scannez ce code QR." : "Scan this QR code."}</li>
          <li>{french ? "Saisissez le code a 6 chiffres genere." : "Enter the generated 6-digit code."}</li>
        </ol>
        <div className="inline-block rounded-xl border border-zinc-200 bg-white p-3">
          <Image src={enrollState.qrCode} alt={french ? "Code QR MFA" : "MFA QR code"} width={240} height={240} unoptimized />
        </div>
        <details className="text-sm text-zinc-600">
          <summary className="cursor-pointer font-medium">{french ? "Impossible de scanner ?" : "Can't scan it?"}</summary>
          <p className="mt-2">{french ? "Saisissez cette cle manuellement :" : "Enter this key manually:"}</p>
          <code className="mt-1 block break-all rounded bg-zinc-100 p-2 text-zinc-900">{enrollState.secret}</code>
        </details>
        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="factorId" value={enrollState.factorId} />
          <label className="block text-sm font-medium text-zinc-800">
            {french ? "Code de verification" : "Verification code"}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 tracking-[0.3em]" />
          </label>
          {verifyState?.error && <p role="alert" className="text-sm text-red-700">{verifyState.error}</p>}
          <button type="submit" disabled={verifying} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {verifying ? (french ? "Verification..." : "Verifying...") : (french ? "Activer le MFA" : "Enable MFA")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={enrollAction}>
      <input type="hidden" name="locale" value={locale} />
      {enrollState?.error && <p role="alert" className="mb-3 text-sm text-red-700">{enrollState.error}</p>}
      <button type="submit" disabled={enrolling} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {enrolling ? (french ? "Preparation..." : "Preparing...") : (french ? "Configurer une application" : "Set up an authenticator app")}
      </button>
    </form>
  );
}
