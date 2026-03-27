export const APP_LOCALES = ["fr", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE_NAME = "minerval-locale";
export const LOCALE_HEADER_NAME = "x-minerval-locale";

const INTL_LOCALE_TAGS: Record<AppLocale, string> = {
  fr: "fr-CD",
  en: "en-US",
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}

export function getPreferredLocale(value: string | null | undefined): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export function getIntlLocaleTag(locale: AppLocale): string {
  return INTL_LOCALE_TAGS[locale];
}

export function getLocaleFromPathname(pathname: string): AppLocale | null {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  return isAppLocale(maybeLocale) ? maybeLocale : null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";

  const trimmed = pathname.slice(locale.length + 1);
  return trimmed.length > 0 ? trimmed : "/";
}

export function localizePathname(locale: AppLocale, pathname: string): string {
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const internalPathname = stripLocaleFromPathname(normalizedPathname);
  return internalPathname === "/"
    ? `/${locale}`
    : `/${locale}${internalPathname}`;
}

export function localizeHref(locale: AppLocale, href: string): string {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!match) return href;

  const [, pathname = "", search = "", hash = ""] = match;
  if (!pathname.startsWith("/")) return href;

  return `${localizePathname(locale, pathname)}${search}${hash}`;
}
