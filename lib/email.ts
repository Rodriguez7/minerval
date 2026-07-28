import { Resend } from "resend";
import { getEmailSender } from "./email-config";
import { renderBrandedEmail } from "./email-template";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  return new Resend(key);
}

export async function sendPayoutCompletedEmail(opts: {
  to: string;
  amount: number;
  currency: string;
  phone: string;
  telecom: string;
}) {
  const resend = getResend();
  const amount = `${opts.amount} ${opts.currency}`;
  const text = `${amount} a été envoyé vers ${opts.phone} (${opts.telecom}). Le montant devrait arriver sous peu.`;
  await resend.emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: "Votre retrait a été envoyé",
    text,
    html: renderBrandedEmail({
      preview: `Votre retrait de ${amount} a été envoyé.`,
      eyebrow: "Retrait envoyé",
      title: "Votre retrait est en route",
      message: "Le transfert a été confirmé. Le montant devrait arriver sur le compte mobile money indiqué sous peu.",
      tone: "success",
      details: [
        { label: "Montant", value: amount },
        { label: "Destination", value: opts.phone },
        { label: "Réseau", value: opts.telecom },
      ],
      action: {
        label: "Ouvrir Minerval",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org",
      },
      note: "Conservez cet e-mail comme confirmation de traitement.",
    }),
  });
}

export async function sendPayoutFailedEmail(opts: {
  to: string;
  amount: number;
  currency: string;
  phone: string;
  telecom: string;
}) {
  const resend = getResend();
  const amount = `${opts.amount} ${opts.currency}`;
  const supportEmail = process.env.LEGAL_CONTACT_EMAIL ?? "contact@minerval.org";
  const text = `Votre demande de retrait de ${amount} vers ${opts.phone} (${opts.telecom}) a échoué. Veuillez contacter le support à ${supportEmail}.`;
  await resend.emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: "Votre retrait n'a pas pu être traité",
    text,
    html: renderBrandedEmail({
      preview: `Le retrait de ${amount} n'a pas pu être traité.`,
      eyebrow: "Action requise",
      title: "Le retrait n'a pas abouti",
      message: "Aucun nouveau retrait n'est nécessaire pour le moment. Contactez notre équipe afin que nous puissions vérifier la transaction.",
      tone: "danger",
      details: [
        { label: "Montant", value: amount },
        { label: "Destination", value: opts.phone },
        { label: "Réseau", value: opts.telecom },
      ],
      action: {
        label: "Contacter le support",
        url: `mailto:${supportEmail}`,
      },
      note: "Ne partagez jamais votre code PIN ou un code à usage unique.",
    }),
  });
}

export async function sendOperationalAlert(opts: {
  to: string;
  subject: string;
  text: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: renderBrandedEmail({
      preview: opts.subject,
      eyebrow: "Alerte opérationnelle",
      title: opts.subject,
      message: "Minerval a détecté un événement nécessitant une vérification de l'équipe opérationnelle.",
      tone: "warning",
      note: opts.text,
      action: {
        label: "Ouvrir Minerval",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org",
      },
    }),
  });
}

export async function sendSchoolVerificationDecisionEmail(opts: {
  to: string;
  schoolName: string;
  decision: "verified" | "rejected";
  note?: string | null;
}) {
  const resend = getResend();
  const approved = opts.decision === "verified";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org";
  const settingsUrl = `${appUrl.replace(/\/$/, "")}/fr/dashboard/settings#verification`;
  const subject = approved
    ? `Vérification approuvée — ${opts.schoolName}`
    : `Corrections demandées — ${opts.schoolName}`;
  const message = approved
    ? "Le dossier de votre établissement a été approuvé. Les fonctionnalités soumises à vérification peuvent maintenant être activées."
    : "Le dossier de votre établissement nécessite des corrections avant son approbation.";

  await resend.emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject,
    text: `${message}${opts.note ? `\n\nCorrection demandée : ${opts.note}` : ""}\n\n${settingsUrl}`,
    html: renderBrandedEmail({
      preview: subject,
      eyebrow: approved ? "Dossier approuvé" : "Action requise",
      title: approved ? "Votre établissement est vérifié" : "Votre dossier doit être corrigé",
      message,
      tone: approved ? "success" : "warning",
      details: [
        { label: "Établissement", value: opts.schoolName },
        {
          label: "Décision",
          value: approved ? "Approuvé" : "Corrections demandées",
        },
      ],
      action: {
        label: "Voir le dossier",
        url: settingsUrl,
      },
      note: opts.note ? `Correction demandée : ${opts.note}` : undefined,
    }),
  });
}
