import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { callProxy, ProxyError } from "@/lib/proxy";
import type { Telecom } from "@/lib/types";

const VALID_TELECOMS: Telecom[] = ["AM", "OM", "MP", "AF"];
const CALLBACK_URL = "https://www.minerval.org/api/serdipay/callback";

export async function POST(req: NextRequest) {
  let body: { student_id?: string; phone?: string; telecom?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { student_id, phone, telecom } = body;

  if (!student_id || !phone || !telecom) {
    return NextResponse.json(
      { error: "student_id, phone, and telecom are required" },
      { status: 400 }
    );
  }

  if (!VALID_TELECOMS.includes(telecom as Telecom)) {
    return NextResponse.json(
      { error: `Invalid telecom. Must be one of: ${VALID_TELECOMS.join(", ")}` },
      { status: 400 }
    );
  }

  // 1. Look up student
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, school_id, name, amount_due, external_id")
    .eq("external_id", student_id)
    .single();

  if (studentErr || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (student.amount_due <= 0) {
    return NextResponse.json({ error: "No fees outstanding for this student" }, { status: 400 });
  }

  // 2. Create pending payment_request
  const { data: paymentRequest, error: insertErr } = await supabase
    .from("payment_requests")
    .insert({
      student_id: student.id,
      school_id: student.school_id,
      amount: student.amount_due,
      phone,
      telecom,
      status: "pending",
    })
    .select()
    .single();

  if (insertErr || !paymentRequest) {
    return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
  }

  // 3. Call proxy
  try {
    await callProxy({
      amount: student.amount_due,
      phone,
      reference: paymentRequest.id,
      telecom: telecom as Telecom,
      callback_url: CALLBACK_URL,
    });

    return NextResponse.json({ payment_request_id: paymentRequest.id, status: "pending" });
  } catch (err) {
    // Mark as failed
    await supabase
      .from("payment_requests")
      .update({ status: "failed" })
      .eq("id", paymentRequest.id);

    if (err instanceof ProxyError) {
      // Pass 409 duplicate transaction through to the client
      if (err.status === 409) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err.status === 400) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Payment service unavailable, please try again" },
      { status: 503 }
    );
  }
}
