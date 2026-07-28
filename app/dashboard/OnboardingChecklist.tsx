import { LocalizedLink } from "@/lib/i18n/LocalizedLink";
import type { AppLocale } from "@/lib/i18n/config";
import type { SchoolReadinessItem } from "@/lib/school-readiness";

export function OnboardingChecklist({
  locale,
  items,
}: {
  locale: AppLocale;
  items: SchoolReadinessItem[];
}) {
  const fr = locale === "fr";
  const complete = items.filter((item) => item.complete).length;
  if (complete === items.length) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-blue-950">
            {fr ? "Préparer Minerval" : "Get Minerval ready"}
          </h2>
          <p className="mt-1 text-sm text-blue-800">
            {fr
              ? `${complete} étape(s) sur ${items.length} terminée(s)`
              : `${complete} of ${items.length} steps complete`}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">
          {Math.round((complete / items.length) * 100)} %
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <LocalizedLink
            key={item.key}
            href={item.href}
            className="flex gap-3 rounded-lg border border-blue-100 bg-white p-3 transition hover:border-blue-300"
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.complete ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {item.complete ? "✓" : "·"}
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-900">{item.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">{item.description}</span>
            </span>
          </LocalizedLink>
        ))}
      </div>
    </section>
  );
}
