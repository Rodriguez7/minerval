import { getIntlLocaleTag, type AppLocale } from "./config";

export function formatNumber(value: number | string, locale: AppLocale): string {
  return new Intl.NumberFormat(getIntlLocaleTag(locale)).format(Number(value));
}

export function formatMoney(
  value: number | string,
  currency: string,
  locale: AppLocale
): string {
  return `${formatNumber(value, locale)} ${currency}`;
}

export function formatDate(
  value: Date | string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  return new Intl.DateTimeFormat(getIntlLocaleTag(locale), options).format(
    new Date(value)
  );
}

export function formatDateTime(
  value: Date | string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  }
): string {
  return new Intl.DateTimeFormat(getIntlLocaleTag(locale), options).format(
    new Date(value)
  );
}
