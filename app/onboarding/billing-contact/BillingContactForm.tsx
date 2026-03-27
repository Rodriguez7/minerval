"use client";
import { useActionState } from "react";
import { updateBillingContact } from "@/app/actions/onboarding";
import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import { useLocale } from "@/lib/i18n/client";
import { getOnboardingCopy } from "@/lib/i18n/copy/onboarding";

const TIMEZONES = [
  { value: "Africa/Kinshasa", label: "Africa/Kinshasa (WAT, UTC+1)" },
  { value: "Africa/Lubumbashi", label: "Africa/Lubumbashi (CAT, UTC+2)" },
  { value: "UTC", label: "UTC" },
];

export function BillingContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const locale = useLocale();
  const copy = getOnboardingCopy(locale);
  const [state, action, isPending] = useActionState(updateBillingContact, null);

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <div>
        <p className="text-sm text-blue-600 font-medium">{copy.billing.step}</p>
        <h1 className="text-2xl font-bold mt-1">{copy.billing.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {copy.billing.description}
        </p>
      </div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label className="block text-sm font-medium mb-1">{copy.billing.emailLabel}</label>
          <input
            name="billingEmail"
            type="email"
            required
            defaultValue={defaultEmail}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{copy.billing.contactLabel}</label>
          <input
            name="billingContact"
            type="text"
            required
            minLength={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{copy.billing.timezoneLabel}</label>
          <select
            name="timezone"
            defaultValue="Africa/Kinshasa"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <div className="flex gap-3">
          <LocalizedLink
            href="/onboarding/import"
            className="flex-1 text-center border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copy.billing.skip}
          </LocalizedLink>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? copy.billing.submitPending : copy.billing.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
