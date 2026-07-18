import type { WhatsAppLocale, WhatsAppMessageKind } from "./types";

export const WHATSAPP_TEMPLATES: Record<
  WhatsAppMessageKind,
  Record<WhatsAppLocale, string>
> = {
  payment_reminder: {
    fr: "minerval_payment_reminder_v1",
  },
  payment_confirmed: {
    fr: "minerval_payment_confirmed_v1",
  },
  payment_failed: {
    fr: "minerval_payment_failed_v1",
  },
};

export function getWhatsAppTemplateName(
  kind: WhatsAppMessageKind,
  locale: WhatsAppLocale
) {
  return WHATSAPP_TEMPLATES[kind][locale];
}
