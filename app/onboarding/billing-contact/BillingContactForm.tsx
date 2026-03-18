"use client";
import { useActionState } from "react";
import { updateBillingContact } from "@/app/actions/onboarding";

const TIMEZONES = [
  { value: "Africa/Kinshasa", label: "Africa/Kinshasa (WAT, UTC+1)" },
  { value: "Africa/Lubumbashi", label: "Africa/Lubumbashi (CAT, UTC+2)" },
  { value: "UTC", label: "UTC" },
];

export function BillingContactForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, isPending] = useActionState(updateBillingContact, null);

  return (
    <div className="bg-white rounded-xl shadow p-8 space-y-6">
      <div>
        <p className="text-sm text-blue-600 font-medium">Step 2 of 3</p>
        <h1 className="text-2xl font-bold mt-1">Billing contact</h1>
        <p className="text-sm text-gray-500 mt-1">
          Used for invoices and payment notifications.
        </p>
      </div>
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Billing email</label>
          <input
            name="billingEmail"
            type="email"
            required
            defaultValue={defaultEmail}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contact name</label>
          <input
            name="billingContact"
            type="text"
            required
            minLength={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
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
          <a
            href="/onboarding/import"
            className="flex-1 text-center border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Skip for now
          </a>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
