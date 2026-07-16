import { NextRequest, NextResponse } from "next/server";
import {
  dispatchQueuedWhatsAppMessages,
  enqueueDueWhatsAppReminders,
} from "@/lib/whatsapp-reminders";

export async function POST(request: NextRequest) {
  const expected = process.env.WHATSAPP_REMINDER_CRON_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received || received !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = request.nextUrl.searchParams.get("dry_run") === "1";
    const enqueue = await enqueueDueWhatsAppReminders(new Date(), dryRun);
    const dispatch = dryRun
      ? { claimed: 0, accepted: 0, failed: 0, cancelled: 0 }
      : await dispatchQueuedWhatsAppMessages();
    return NextResponse.json({ ok: true, enqueue, dispatch });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "WhatsApp reminder worker failed" },
      { status: 500 }
    );
  }
}
