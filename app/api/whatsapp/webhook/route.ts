import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
  verifyMetaWebhookSignature,
  WHATSAPP_STATUS_RANK,
} from "@/lib/meta-whatsapp-webhook";
import { reportOperationalIssue } from "@/lib/operations";

type MetaStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

type MetaIncomingMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
};

type MetaWebhook = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: MetaStatus[];
        messages?: MetaIncomingMessage[];
      };
    }>;
  }>;
};

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    challenge &&
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function eventTimestamp(value: string | undefined) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

async function updateDeliveryStatus(status: MetaStatus) {
  if (!status.id || !status.status || status.status === "deleted") return;
  const admin = getAdminClient();
  const { data: message } = await admin
    .from("whatsapp_messages")
    .select("id, status")
    .eq("meta_message_id", status.id)
    .maybeSingle();
  if (!message) return;

  const incomingRank = WHATSAPP_STATUS_RANK[status.status] ?? -1;
  const currentRank = WHATSAPP_STATUS_RANK[message.status] ?? -1;
  if (incomingRank < currentRank && status.status !== "failed") return;

  const timestamp = eventTimestamp(status.timestamp);
  const firstError = status.errors?.[0];
  const fields: Record<string, unknown> = { status: status.status };
  if (status.status === "sent") fields.sent_at = timestamp;
  if (status.status === "delivered") fields.delivered_at = timestamp;
  if (status.status === "read") fields.read_at = timestamp;
  if (status.status === "failed") {
    fields.failed_at = timestamp;
    fields.error_code = firstError?.code ? String(firstError.code) : "meta_delivery_failed";
    fields.error_message = firstError?.message ?? firstError?.title ?? "Meta delivery failed";
    fields.attempt_count = 3;
  }

  await admin.from("whatsapp_messages").update(fields).eq("id", message.id);
}

async function processIncomingMessage(message: MetaIncomingMessage) {
  if (!message.from) return;
  const body = message.type === "text" ? message.text?.body?.trim().toUpperCase() ?? "" : "";
  if (!["STOP", "ARRET", "ARRÊT"].includes(body)) return;

  const admin = getAdminClient();
  const { data: guardians } = await admin
    .from("guardians")
    .update({ whatsapp_opted_out_at: new Date().toISOString() })
    .eq("whatsapp_phone", message.from.replace(/\D/g, ""))
    .is("whatsapp_opted_out_at", null)
    .select("id");

  const guardianIds = (guardians ?? []).map((guardian) => guardian.id);
  if (guardianIds.length > 0) {
    await admin
      .from("whatsapp_messages")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: "guardian_opt_out",
      })
      .in("guardian_id", guardianIds)
      .in("status", ["queued", "sending", "failed"]);
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhook;
  try {
    payload = JSON.parse(rawBody) as MetaWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ received: true });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        for (const status of change.value?.statuses ?? []) await updateDeliveryStatus(status);
        for (const message of change.value?.messages ?? []) await processIncomingMessage(message);
      }
    }
  } catch (error) {
    await reportOperationalIssue({
      source: "whatsapp-webhook",
      message: error instanceof Error ? error.message : "WhatsApp webhook processing failed",
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
