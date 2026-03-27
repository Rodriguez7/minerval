import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { callProxy, ProxyError } from "@/lib/proxy";
import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { getClientIp } from "@/lib/request";
import { consumeRateLimit } from "@/lib/rate-limit";
import { computeFee } from "@/lib/fee";
import type { Telecom } from "@/lib/types";

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

  const rateLimit = consumeRateLimit({
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
    policy?.parent_fee_bps ?? 275
  );

  const { data: paymentRequest, error: insertErr } = await admin
    .from("payment_requests")
    .insert({
      student_id: student.id,
      school_id: school.id,
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

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/serdipay/callback`;

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

    return NextResponse.json({ payment_request_id: paymentRequest.id, status: "pending" });
  } catch (err) {
    await admin
      .from("payment_requests")
      .update({ status: "failed" })
      .eq("id", paymentRequest.id);

    if (err instanceof ProxyError) {
      if (err.status === 409) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err.status === 400) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Service de paiement indisponible, reessayez" },
      { status: 503 }
    );
  }
}
