"use client";
import { useActionState, useCallback, useState } from "react";
import { signup } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { getAuthCopy } from "@/lib/i18n/copy/auth";
import { Turnstile } from "@/lib/Turnstile";

export default function SignupPage() {
  const locale = useLocale();
  const copy = getAuthCopy(locale);
  const [state, action, isPending] = useActionState(signup, null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const onCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaRequired = Boolean(captchaSiteKey);

  if (state?.success) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="absolute right-4 top-4 md:right-6 md:top-6">
          <LanguageSwitcher />
        </div>
        <div className="bg-white rounded-xl shadow p-8 w-full max-w-md text-center space-y-5">
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700"
            aria-hidden="true"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-10 5L2 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{copy.signup.successTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {copy.signup.successDescription}
            </p>
          </div>
          <LocalizedLink
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {copy.signup.successBackToSignIn}
          </LocalizedLink>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageSwitcher />
      </div>
      <div className="bg-white rounded-xl shadow p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{copy.signup.heading}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {copy.signup.subheading}
          </p>
        </div>
        <form action={action} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />
          <div>
            <label className="block text-sm font-medium mb-1">{copy.signup.emailLabel}</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{copy.signup.passwordLabel}</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">{copy.signup.passwordHint}</p>
          </div>
          <label className="flex items-start gap-2 text-sm leading-5 text-gray-600">
            <input
              name="legalAccepted"
              type="checkbox"
              value="yes"
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span>
              {copy.signup.legalPrefix}{" "}
              <LocalizedLink href="/terms" className="text-blue-600 hover:underline">
                {copy.signup.termsLink}
              </LocalizedLink>{" "}
              {copy.signup.legalJoin}{" "}
              <LocalizedLink href="/privacy" className="text-blue-600 hover:underline">
                {copy.signup.privacyLink}
              </LocalizedLink>
              .
            </span>
          </label>
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <Turnstile siteKey={captchaSiteKey} onToken={onCaptchaToken} resetSignal={state?.error} />
          <button
            type="submit"
            disabled={isPending || (captchaRequired && !captchaToken)}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? copy.signup.submitPending : copy.signup.submit}
          </button>
        </form>
        <p className="text-sm text-center text-gray-500">
          {copy.signup.footerPrompt}{" "}
          <LocalizedLink href="/login" className="text-blue-600 hover:underline">
            {copy.signup.footerLink}
          </LocalizedLink>
        </p>
      </div>
    </div>
  );
}
