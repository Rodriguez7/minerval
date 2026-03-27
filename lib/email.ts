import { Resend } from "resend";

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
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Minerval <no-reply@minerval.app>",
    to: opts.to,
    subject: "Votre retrait a ete envoye",
    text: `${opts.amount} ${opts.currency} a ete envoye vers ${opts.phone} (${opts.telecom}). Le montant devrait arriver sous peu.`,
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
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Minerval <no-reply@minerval.app>",
    to: opts.to,
    subject: "Votre retrait n'a pas pu etre traite",
    text: `Votre demande de retrait de ${opts.amount} ${opts.currency} vers ${opts.phone} (${opts.telecom}) a echoue. Veuillez contacter le support.`,
  });
}
