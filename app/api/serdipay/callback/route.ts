import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { verifySerdiPayCallback } from "@/lib/serdipay";

interface SerdiPayCallback {
  message?: string;
  status?: number;
  payment?: {
    status?: string;
    transactionId?: string;
    sessionId?: string | number;
    sessionStatus?: number;
  };
}

export async function POST(req: NextRequest) {
  const authorization = verifySerdiPayCallback(req);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let body: SerdiPayCallback;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const reference = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!reference || !paymentStatus) {
    return NextResponse.json({ error: "message et payment.status sont obligatoires" }, { status: 400 });
  }

  if (paymentStatus !== "success" && paymentStatus !== "failed") {
    return NextResponse.json({ error: "payment.status invalide" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: payment, error: lookupErr } = await admin
    .from("payment_requests")
    .select("id, student_id, amount, fee_amount, status")
    .eq("id", reference)
    .single();

  if (lookupErr || !payment) {
    return NextResponse.json({ message: "Reference introuvable" }, { status: 200 });
  }

  if (payment.status !== "pending") {
    return NextResponse.json({ message: "Deja traite" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  if (isSuccess) {
    const { data: student, error: studentLookupError } = await admin
      .from("students")
      .select("amount_due")
      .eq("id", payment.student_id)
      .single();

    if (studentLookupError || !student) {
      return NextResponse.json(
        { error: "Impossible de lire le solde eleve" },
        { status: 500 }
      );
    }

    const schoolFeePaid = Math.max(0, payment.amount - (payment.fee_amount ?? 0));
    const remainingDue = Math.max(0, Number(student.amount_due) - schoolFeePaid);
    const { error: studentUpdateError } = await admin
      .from("students")
      .update({ amount_due: remainingDue })
      .eq("id", payment.student_id);

    if (studentUpdateError) {
      return NextResponse.json(
        { error: "Impossible de mettre a jour le solde eleve" },
        { status: 500 }
      );
    }
  }

  const { error: paymentUpdateError } = await admin
    .from("payment_requests")
    .update({
      status: isSuccess ? "success" : "failed",
      reconciliation_status: "reconciled",
      reconciliation_updated_at: new Date().toISOString(),
      reconciliation_updated_by: "serdipay_callback",
      updated_at: new Date().toISOString(),
      serdipay_transaction_id: transactionId ?? null,
      ...(isSuccess ? { settled_at: new Date().toISOString() } : {}),
    })
    .eq("id", payment.id);

  if (paymentUpdateError) {
    return NextResponse.json(
      { error: "Impossible de finaliser le paiement" },
      { status: 500 }
    );
  }

  const { error: eventError } = await admin.from("payment_events").insert({
    payment_request_id: payment.id,
    event_type: isSuccess ? "callback_success" : "callback_failed",
    payload: body as Record<string, unknown>,
  });

  if (eventError) {
    console.error("[serdipay-callback] payment event insert failed", payment.id, eventError.message);
  }

  return NextResponse.json({ message: "OK" });
}
