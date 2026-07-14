import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "@/lib/email";
import { verifySerdiPayCallback } from "@/lib/serdipay";
import { reportOperationalIssue } from "@/lib/operations";

export async function POST(req: NextRequest) {
  const authorization = verifySerdiPayCallback(req);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let body: { message?: string; payment?: { status?: string; transactionId?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const payoutId = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!payoutId || !paymentStatus) {
    return NextResponse.json({ error: "message et payment.status sont obligatoires" }, { status: 400 });
  }

  if (paymentStatus !== "success" && paymentStatus !== "failed") {
    return NextResponse.json({ error: "payment.status invalide" }, { status: 400 });
  }

  const admin = getAdminClient();

  // 1. Lookup payout
  const { data: payout } = await admin
    .from("school_payouts")
    .select("id, school_id, requested_by, amount, fee_amount, net_amount, phone, telecom, status")
    .eq("id", payoutId)
    .single();

  if (!payout) {
    return NextResponse.json({ message: "versement inconnu, ignore" }, { status: 200 });
  }

  if (payout.status === "completed" || payout.status === "failed") {
    return NextResponse.json({ message: "deja traite" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  // 2. Fetch owner email (from profiles table)
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", payout.requested_by)
    .single();

  // 3. Fetch school currency
  const { data: school } = await admin
    .from("schools")
    .select("currency")
    .eq("id", payout.school_id)
    .single();

  const ownerEmail = (profile as { email?: string } | null)?.email;
  const currency = (school as { currency?: string } | null)?.currency ?? "";

  // 4. Update payout status
  if (isSuccess) {
    const { error: updateError } = await admin
      .from("school_payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        serdipay_transaction_id: transactionId ?? null,
      })
      .eq("id", payoutId);

    if (updateError) {
      await reportOperationalIssue({
        source: "serdipay-payout-callback",
        message: "Successful payout callback could not be persisted.",
        reference: payoutId,
      });
      return NextResponse.json(
        { error: "Impossible de finaliser le versement" },
        { status: 500 }
      );
    }

    if (ownerEmail) {
      await Promise.resolve(sendPayoutCompletedEmail({
        to: ownerEmail,
        amount: payout.net_amount,
        currency,
        phone: payout.phone,
        telecom: payout.telecom,
      })).catch(console.error);
    }
  } else {
    const { error: updateError } = await admin
      .from("school_payouts")
      .update({
        status: "failed",
        failure_reason: paymentStatus,
      })
      .eq("id", payoutId);

    if (updateError) {
      await reportOperationalIssue({
        source: "serdipay-payout-callback",
        message: "Failed payout callback could not be persisted.",
        reference: payoutId,
      });
      return NextResponse.json(
        { error: "Impossible de finaliser le versement" },
        { status: 500 }
      );
    }

    if (ownerEmail) {
      await Promise.resolve(sendPayoutFailedEmail({
        to: ownerEmail,
        amount: payout.net_amount,
        currency,
        phone: payout.phone,
        telecom: payout.telecom,
      })).catch(console.error);
    }
  }

  return NextResponse.json({ message: "ok" }, { status: 200 });
}
