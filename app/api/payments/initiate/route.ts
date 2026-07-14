import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { callProxy, ProxyError } from "@/lib/proxy";
import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { getClientIp } from "@/lib/request";
import { consumeRateLimit } from "@/lib/rate-limit";
import { buildSerdiPayCallbackUrl, generateReceiptAccessToken } from "@/lib/serdipay";
import { computeFee, DEFAULT_PARENT_FEE_BPS } from "@/lib/fee";
import type { Telecom } from "@/lib/types";
import { reportOperationalIssue } from "@/lib/operations";

const VALID_TELECOMS: Telecom[] = ["AM", "OM", "MP", "AF"];

export async function POST(req: NextRequest) {
  let body: {
    student_id?: string;
    phone?: string;
    telecom?: string;
    payment_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { student_id, phone, telecom, payment_token } = body;

  if (!student_id || !phone || !telecom || !payment_token) {
    return NextResponse.json(
      { error: "student_id, phone, telecom et payment_token sont obligatoires" },
      { status: 400 }
    );
  }

  if (!VALID_TELECOMS.includes(telecom as Telecom)) {
    return NextResponse.json(
      { error: `Operateur invalide. Valeurs autorisees : ${VALID_TELECOMS.join(", ")}` },
      { status: 400 }
    );
  }

  const school = await getSchoolByPaymentAccessToken(payment_token);
  if (!school) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const rateLimit = await consumeRateLimit({
    key: `payment-initiate:${school.id}:${getClientIp(req.headers)}`,
    limit: 5,
    windowMs: 300_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Trop de tentatives de paiement. Attendez ${rateLimit.retryAfterSeconds} secondes puis reessayez.`,
      },
      { status: 429 }
    );
  }

  const admin = getAdminClient();

  const { data: student, error: studentErr } = await admin
    .from("students")
    .select("id, school_id, full_name, amount_due, external_id")
    .eq("school_id", school.id)
    .eq("external_id", student_id)
    .single();

  if (studentErr || !student) {
    return NextResponse.json({ error: "Eleve introuvable" }, { status: 404 });
  }

  if (student.amount_due <= 0) {
    return NextResponse.json({ error: "Aucun frais en attente pour cet eleve" }, { status: 400 });
  }

  // Fetch pricing policy and compute parent fee
  const { data: policy } = await admin
    .from("school_pricing_policies")
    .select("parent_fee_bps")
    .eq("school_id", school.id)
    .single();

  const { feeAmount, totalAmount } = computeFee(
    student.amount_due,
    policy?.parent_fee_bps ?? DEFAULT_PARENT_FEE_BPS
  );

  // Keep one payment attempt active long enough for delayed mobile-money callbacks.
  // This prevents a timeout followed by a retry from charging the parent twice.
  const idempotencyWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: existingPayment } = await admin
    .from("payment_requests")
    .select("id, receipt_access_token")
    .eq("student_id", student.id)
    .eq("status", "pending")
    .gte("created_at", idempotencyWindow)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPayment) {
    return NextResponse.json({
      payment_request_id: existingPayment.id,
      receipt_access_token: existingPayment.receipt_access_token,
      status: "pending",
    });
  }

  const { data: paymentRequest, error: insertErr } = await admin
    .from("payment_requests")
    .insert({
      student_id: student.id,
      school_id: school.id,
      receipt_access_token: generateReceiptAccessToken(),
      amount: totalAmount,
      fee_amount: feeAmount,
      phone,
      telecom,
      status: "pending",
      reconciliation_status: "pending_review",
      reconciliation_updated_at: new Date().toISOString(),
      reconciliation_updated_by: "system",
    })
    .select()
    .single();

  if (insertErr || !paymentRequest) {
    return NextResponse.json({ error: "Impossible de creer le paiement" }, { status: 500 });
  }

  let callbackUrl: string;
  try {
    callbackUrl = buildSerdiPayCallbackUrl("/api/serdipay/callback");
  } catch {
    await admin
      .from("payment_requests")
      .update({ status: "failed" })
      .eq("id", paymentRequest.id);

    await reportOperationalIssue({
      source: "payment-initiation",
      severity: "warning",
      message: "SerdiPay response was ambiguous; payment requires callback reconciliation.",
      reference: paymentRequest.id,
    });

    return NextResponse.json(
      { error: "Configuration du callback de paiement manquante" },
      { status: 503 }
    );
  }

  try {
    await callProxy({
      amount: totalAmount,
      phone,
      reference: paymentRequest.id,
      telecom: telecom as Telecom,
      callback_url: callbackUrl,
    });

    await admin.from("payment_events").insert({
      payment_request_id: paymentRequest.id,
      event_type: "initiated",
      payload: { phone, telecom, amount: totalAmount, fee_amount: feeAmount },
    });

    return NextResponse.json({
      payment_request_id: paymentRequest.id,
      receipt_access_token: paymentRequest.receipt_access_token,
      status: "pending",
    });
  } catch (err) {
    if (err instanceof ProxyError) {
      if (err.status >= 400 && err.status < 500) {
        await admin
          .from("payment_requests")
          .update({ status: "failed" })
          .eq("id", paymentRequest.id);

        return NextResponse.json({ error: err.message }, { status: err.status });
      }
    }

    // A timeout or upstream 5xx is ambiguous: SerdiPay may already have accepted
    // the transaction. Keep it pending so a signed callback can settle it, and
    // flag it for reconciliation instead of enabling an unsafe duplicate retry.
    await admin
      .from("payment_requests")
      .update({
        reconciliation_status: "needs_review",
        reconciliation_note: "Reponse SerdiPay incertaine; en attente du callback signe.",
        reconciliation_updated_at: new Date().toISOString(),
        reconciliation_updated_by: "payment_initiation",
      })
      .eq("id", paymentRequest.id);

    return NextResponse.json(
      {
        error: "Confirmation du paiement en attente. Verifiez le recu avant de reessayer.",
        payment_request_id: paymentRequest.id,
        receipt_access_token: paymentRequest.receipt_access_token,
        status: "pending",
      },
      { status: 202 }
    );
  }
}
