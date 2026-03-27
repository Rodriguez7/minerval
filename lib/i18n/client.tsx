"use client";

import { createContext, useContext } from "react";
import { localizeHref, type AppLocale } from "./config";
import type { Messages } from "./messages";

type I18nContextValue = {
  locale: AppLocale;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: AppLocale;
  messages: Messages;
}) {
  return (
    <I18nContext.Provider value={{ locale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export function useLocale(): AppLocale {
  return useI18n().locale;
}

export function useTranslations(namespace?: string) {
  const { messages } = useI18n();

  return (key: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const value = getMessageValue(messages, fullKey);
    return typeof value === "string" ? value : fullKey;
  };
}

export function useLocalizedHref(href: string): string {
  return localizeHref(useLocale(), href);
}

function getMessageValue(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, messages);
}
