"use client";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { getAuthCopy } from "@/lib/i18n/copy/auth";

export default function SignupPage() {
  const locale = useLocale();
  const copy = getAuthCopy(locale);
  const [state, action, isPending] = useActionState(signup, null);

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
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
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
