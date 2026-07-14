import Link from "next/link";
import type { AppLocale } from "@/lib/i18n/config";
import { localizePathname } from "@/lib/i18n/config";
import {
  LEGAL_VERSION,
  getLegalDocument,
  getLegalOperator,
} from "@/lib/legal";

export function LegalPage({
  locale,
  kind,
}: {
  locale: AppLocale;
  kind: "privacy" | "terms" | "refunds";
}) {
  const document = getLegalDocument(locale, kind);
  const operator = getLegalOperator();
  const isFrench = locale === "fr";

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <Link
          href={localizePathname(locale, "/")}
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          ← Minerval
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-950">
          {document.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          {document.description}
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          {document.updatedLabel}: {LEGAL_VERSION}
        </p>

        <div className="mt-10 space-y-9">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-zinc-950">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-zinc-700">
                  {paragraph}
                </p>
              ))}
              {section.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-700">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700">
          <p className="font-semibold text-zinc-950">{operator.name}</p>
          {operator.address && <p>{operator.address}</p>}
          <p>
            Contact:{" "}
            <a className="text-blue-700 hover:underline" href={`mailto:${operator.contactEmail}`}>
              {operator.contactEmail}
            </a>
          </p>
          {kind === "privacy" && (
            <p>
              {isFrench ? "Confidentialite" : "Privacy"}:{" "}
              <a className="text-blue-700 hover:underline" href={`mailto:${operator.privacyEmail}`}>
                {operator.privacyEmail}
              </a>
            </p>
          )}
        </section>

        <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-200 pt-6 text-sm">
          <Link className="text-blue-700 hover:underline" href={localizePathname(locale, "/privacy")}>
            {isFrench ? "Confidentialite" : "Privacy"}
          </Link>
          <Link className="text-blue-700 hover:underline" href={localizePathname(locale, "/terms")}>
            {isFrench ? "Conditions" : "Terms"}
          </Link>
          <Link className="text-blue-700 hover:underline" href={localizePathname(locale, "/refunds")}>
            {isFrench ? "Remboursements" : "Refunds"}
          </Link>
        </nav>
      </article>
    </main>
  );
}
