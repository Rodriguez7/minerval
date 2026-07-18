import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { verifySerdiPayCallback } from "@/lib/serdipay";
import { reportOperationalIssue } from "@/lib/operations";
import { getWhatsAppTemplateName } from "@/lib/whatsapp-templates";

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
    .select("id, student_id, school_id, amount, fee_amount, status, receipt_access_token, students(reminder_cycle_id)")
    .eq("id", reference)
    .single();

  if (lookupErr || !payment) {
    return NextResponse.json({ message: "Reference introuvable" }, { status: 200 });
  }

  if (payment.status !== "pending") {
    return NextResponse.json({ message: "Deja traite" }, { status: 200 });
  }

  const isSuccess = paymentStatus === "success";

  let reminderCycleId: string | null = null;

  if (isSuccess) {
    const { data: student, error: studentLookupError } = await admin
      .from("students")
      .select("amount_due, reminder_cycle_id")
      .eq("id", payment.student_id)
      .single();

    if (studentLookupError || !student) {
      await reportOperationalIssue({
        source: "serdipay-payment-callback",
        message: "Student balance lookup failed during successful payment settlement.",
        reference: payment.id,
      });
      return NextResponse.json(
        { error: "Impossible de lire le solde eleve" },
        { status: 500 }
      );
    }

    const schoolFeePaid = Math.max(0, payment.amount - (payment.fee_amount ?? 0));
    const remainingDue = Math.max(0, Number(student.amount_due) - schoolFeePaid);
    reminderCycleId = student.reminder_cycle_id;
    const { error: studentUpdateError } = await admin
      .from("students")
      .update({
        amount_due: remainingDue,
        ...(remainingDue === 0
          ? {
              balance_due_at: null,
              reminders_paused_until: null,
              reminder_stop_reason: "paid",
            }
          : {}),
      })
      .eq("id", payment.student_id);

    if (studentUpdateError) {
      await reportOperationalIssue({
        source: "serdipay-payment-callback",
        message: "Student balance update failed during successful payment settlement.",
        reference: payment.id,
      });
      return NextResponse.json(
        { error: "Impossible de mettre a jour le solde eleve" },
        { status: 500 }
      );
    }
  }

  if (!isSuccess) {
    const student = payment.students as unknown as { reminder_cycle_id: string | null } | null;
    reminderCycleId = student?.reminder_cycle_id ?? null;
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
    await reportOperationalIssue({
      source: "serdipay-payment-callback",
      message: "Payment finalization could not be persisted.",
      reference: payment.id,
    });
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
    await reportOperationalIssue({
      source: "serdipay-payment-callback",
      severity: "warning",
      message: "Payment settled but its audit event could not be persisted.",
      reference: payment.id,
    });
  }

  if (reminderCycleId) {
    if (isSuccess) {
      const { error: cancelError } = await admin.rpc("cancel_student_whatsapp_messages", {
        p_student_id: payment.student_id,
        p_reminder_cycle_id: reminderCycleId,
        p_reason: "payment_success",
      });
      if (cancelError) {
        await reportOperationalIssue({
          source: "serdipay-payment-callback",
          severity: "warning",
          message: "Payment succeeded but queued WhatsApp reminders could not be cancelled.",
          reference: payment.id,
        });
      }
    }

    const [{ data: studentGuardian }, { data: school }] = await Promise.all([
      admin
        .from("student_guardians")
        .select("guardian_id, guardians!inner(preferred_locale, whatsapp_opted_out_at)")
        .eq("student_id", payment.student_id)
        .eq("is_primary", true)
        .maybeSingle(),
      admin.from("schools").select("currency").eq("id", payment.school_id).single(),
    ]);

    const guardian = studentGuardian?.guardians as unknown as
      | { preferred_locale: "fr"; whatsapp_opted_out_at: string | null }
      | null;
    if (studentGuardian?.guardian_id && guardian && !guardian.whatsapp_opted_out_at && school) {
      const kind = isSuccess ? "payment_confirmed" : "payment_failed";
      const { error: notificationError } = await admin.from("whatsapp_messages").insert({
        school_id: payment.school_id,
        student_id: payment.student_id,
        guardian_id: studentGuardian.guardian_id,
        reminder_cycle_id: reminderCycleId,
        kind,
        stage: null,
        template_name: getWhatsAppTemplateName(kind, "fr"),
        locale: "fr",
        scheduled_for: new Date().toISOString(),
        amount_snapshot: payment.amount,
        currency: school.currency,
        receipt_access_token: isSuccess ? payment.receipt_access_token : null,
      });

      if (notificationError) {
        await reportOperationalIssue({
          source: "serdipay-payment-callback",
          severity: "warning",
          message: `Payment settled but WhatsApp notification could not be queued: ${notificationError.message}`,
          reference: payment.id,
        });
      }
    }
  }

  return NextResponse.json({ message: "OK" });
}
