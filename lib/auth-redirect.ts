import { localizePathname, type AppLocale } from "@/lib/i18n/config";

const PROTECTED_DESTINATION = /^\/(fr|en)\/(dashboard|onboarding|account)(?:\/|$)/;

export function getSafeAuthNext(
  rawNext: string | null | undefined,
  locale: AppLocale
) {
  const fallback = localizePathname(locale, "/dashboard");
  if (!rawNext || !PROTECTED_DESTINATION.test(rawNext)) return fallback;

  try {
    const parsed = new URL(rawNext, "https://www.minerval.org");
    if (parsed.origin !== "https://www.minerval.org") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}
