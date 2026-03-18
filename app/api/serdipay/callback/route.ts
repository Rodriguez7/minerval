import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

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
  let body: SerdiPayCallback;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!reference || !paymentStatus) {
    return NextResponse.json({ error: "message and payment.status are required" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: payment, error: lookupErr } = await admin
    .from("payment_requests")
    .select("id, student_id, amount, status")
    .eq("id", reference)
    .single();

  if (lookupErr || !payment) {
    return NextResponse.json({ message: "Reference not found" }, { status: 200 });
  }

  if (payment.status !== "pending") {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  await admin
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

  await admin.from("payment_events").insert({
    payment_request_id: payment.id,
    event_type: isSuccess ? "callback_success" : "callback_failed",
    payload: body as Record<string, unknown>,
  });

  if (isSuccess) {
    await admin
      .from("students")
      .update({ amount_due: 0 })
      .eq("id", payment.student_id);
  }

  return NextResponse.json({ message: "OK" });
}
