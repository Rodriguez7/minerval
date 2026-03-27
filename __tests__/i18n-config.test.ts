import { describe, expect, test } from "vitest";
import {
  DEFAULT_LOCALE,
  getIntlLocaleTag,
  getLocaleFromPathname,
  getPreferredLocale,
  localizeHref,
  localizePathname,
  stripLocaleFromPathname,
} from "@/lib/i18n/config";

describe("i18n config", () => {
  test("defaults to french when locale is missing or invalid", () => {
    expect(getPreferredLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(getPreferredLocale("de")).toBe(DEFAULT_LOCALE);
  });

  test("extracts locale prefixes from pathnames", () => {
    expect(getLocaleFromPathname("/fr/dashboard")).toBe("fr");
    expect(getLocaleFromPathname("/en")).toBe("en");
    expect(getLocaleFromPathname("/dashboard")).toBeNull();
  });

  test("strips locale prefixes from pathnames", () => {
    expect(stripLocaleFromPathname("/fr/dashboard")).toBe("/dashboard");
    expect(stripLocaleFromPathname("/en")).toBe("/");
    expect(stripLocaleFromPathname("/login")).toBe("/login");
  });

  test("localizes pathnames and hrefs", () => {
    expect(localizePathname("fr", "/")).toBe("/fr");
    expect(localizePathname("en", "/dashboard")).toBe("/en/dashboard");
    expect(localizeHref("fr", "/dashboard?tab=payments#summary")).toBe(
      "/fr/dashboard?tab=payments#summary"
    );
    expect(localizeHref("en", "/fr/login")).toBe("/en/login");
  });

  test("returns untouched external links", () => {
    expect(localizeHref("fr", "https://example.com")).toBe(
      "https://example.com"
    );
    expect(localizeHref("fr", "#section")).toBe("#section");
  });

  test("maps app locales to intl tags", () => {
    expect(getIntlLocaleTag("fr")).toBe("fr-CD");
    expect(getIntlLocaleTag("en")).toBe("en-US");
  });
});
