import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  // body.message = our payment_request.id (the reference we sent)
  // body.payment.status = "success" | "failed"
  const reference = body.message;
  const paymentStatus = body.payment?.status;
  const transactionId = body.payment?.transactionId;

  if (!reference || !paymentStatus) {
    return NextResponse.json({ error: "message and payment.status are required" }, { status: 400 });
  }

  // 1. Look up payment_request by id (the reference we sent to SerdiPay)
  const { data: payment, error: lookupErr } = await supabase
    .from("payment_requests")
    .select("id, student_id, amount, status")
    .eq("id", reference)
    .single();

  if (lookupErr || !payment) {
    // Return 200 — unknown references should not trigger SerdiPay retries
    return NextResponse.json({ message: "Reference not found" }, { status: 200 });
  }

  // 2. Idempotency
  if (payment.status !== "pending") {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  // 3. Update payment_request
  await supabase
    .from("payment_requests")
    .update({
      status: isSuccess ? "success" : "failed",
      serdipay_transaction_id: transactionId ?? null,
      ...(isSuccess ? { settled_at: new Date().toISOString() } : {}),
    })
    .eq("id", payment.id);

  // 4. If success: set student amount_due to 0
  if (isSuccess) {
    await supabase
      .from("students")
      .update({ amount_due: 0 })
      .eq("id", payment.student_id);
  }

  return NextResponse.json({ message: "OK" });
}
