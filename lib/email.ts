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
    subject: "Your withdrawal has been sent",
    text: `${opts.amount} ${opts.currency} has been sent to ${opts.phone} (${opts.telecom}). It should arrive shortly.`,
  });
}

export async function sendPayoutFailedEmail(opts: {
  to: string;
  amount: number;
  currency: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Minerval <no-reply@minerval.app>",
    to: opts.to,
    subject: "Your withdrawal could not be processed",
    text: `Your withdrawal request of ${opts.amount} ${opts.currency} failed. Please contact support.`,
  });
}
