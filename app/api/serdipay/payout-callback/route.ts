import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-serdipay-secret");
  if (
    process.env.SERDIPAY_CALLBACK_SECRET &&
    secret !== process.env.SERDIPAY_CALLBACK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; payment?: { status?: string; transactionId?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payoutId = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!payoutId || !paymentStatus) {
    return NextResponse.json({ error: "message and payment.status are required" }, { status: 400 });
  }

  const admin = getAdminClient();

  // 1. Lookup payout
  const { data: payout } = await admin
    .from("school_payouts")
    .select("id, school_id, requested_by, amount, phone, telecom, status")
    .eq("id", payoutId)
    .single();

  if (!payout) {
    return NextResponse.json({ message: "unknown payout, ignored" }, { status: 200 });
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
    await admin
      .from("school_payouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        serdipay_transaction_id: transactionId ?? null,
      })
      .eq("id", payoutId);

    if (ownerEmail) {
      await Promise.resolve(sendPayoutCompletedEmail({
        to: ownerEmail,
        amount: payout.amount,
        currency,
        phone: payout.phone,
        telecom: payout.telecom,
      })).catch(console.error);
    }
  } else {
    await admin
      .from("school_payouts")
      .update({
        status: "failed",
        failure_reason: paymentStatus,
      })
      .eq("id", payoutId);

    if (ownerEmail) {
      await Promise.resolve(sendPayoutFailedEmail({
        to: ownerEmail,
        amount: payout.amount,
        currency,
        phone: payout.phone,
        telecom: payout.telecom,
      })).catch(console.error);
    }
  }

  return NextResponse.json({ message: "ok" }, { status: 200 });
}
