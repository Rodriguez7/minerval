import type { AppLocale } from "./config";
import { enMessages } from "./messages/en";
import { frMessages } from "./messages/fr";

type MessageSchema = {
  meta: {
    title: string;
    description: string;
  };
  common: {
    languages: {
      fr: string;
      en: string;
    };
  };
};

export const messagesByLocale = {
  fr: frMessages,
  en: enMessages,
} satisfies Record<AppLocale, MessageSchema>;

export type Messages = MessageSchema;

export function getMessages(locale: AppLocale): Messages {
  return messagesByLocale[locale];
}
