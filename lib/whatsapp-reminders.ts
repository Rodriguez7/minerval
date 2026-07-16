import { getAdminClient } from "./supabase";
import { createStudentPaymentLink, revokeStudentPaymentLink } from "./student-payment-link";
import { MetaWhatsAppError, sendWhatsAppTemplate } from "./meta-whatsapp";
import { getWhatsAppTemplateName } from "./whatsapp-templates";
import { reportOperationalIssue } from "./operations";
import type { WhatsAppLocale, WhatsAppMessageKind } from "./types";
import { collectAllPages } from "./paged-query";

export const REMINDER_DAY_OFFSETS = [0, 3, 7, 14, 28, 42] as const;

type GuardianJoin = {
  id: string;
  full_name: string;
  whatsapp_phone: string;
  preferred_locale: WhatsAppLocale;
  whatsapp_opt_in_at: string;
  whatsapp_opted_out_at: string | null;
};

type EligibleStudentRow = {
  id: string;
  amount_due: number;
  balance_due_at: string;
  reminder_cycle_id: string;
  reminders_paused_until: string | null;
  reminder_stop_reason: string | null;
  created_at: string;
  student_guardians: Array<{ guardians: GuardianJoin | GuardianJoin[] }>;
};

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

function localDayNumber(date: Date, timezone: string) {
  const { year, month, day } = localDateParts(date, timezone);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getReminderStage(opts: {
  now: Date;
  dueAt: Date;
  timezone: string;
  maxReminders: number;
}) {
  const daysOverdue = localDayNumber(opts.now, opts.timezone) - localDayNumber(opts.dueAt, opts.timezone);
  let stage: number | null = null;
  for (let index = 0; index < Math.min(opts.maxReminders, REMINDER_DAY_OFFSETS.length); index += 1) {
    if (daysOverdue >= REMINDER_DAY_OFFSETS[index]) stage = index;
  }
  return stage;
}

export async function enqueueDueWhatsAppReminders(now = new Date(), dryRun = false) {
  const admin = getAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("school_whatsapp_settings")
    .select("school_id, automatic_reminders_enabled, local_send_hour, max_reminders, paused_until, schools!inner(id, name, currency, timezone, status, verification_status)")
    .eq("automatic_reminders_enabled", true);

  if (settingsError) throw new Error(`Could not load WhatsApp settings: ${settingsError.message}`);

  let eligible = 0;
  let enqueued = 0;

  for (const row of settings ?? []) {
    const school = (Array.isArray(row.schools) ? row.schools[0] : row.schools) as unknown as {
      id: string;
      timezone: string;
      status: string;
      verification_status: string;
      currency: string;
    } | null;
    if (!school || school.status !== "active" || school.verification_status !== "verified") continue;
    if (row.paused_until && new Date(row.paused_until).getTime() > now.getTime()) continue;

    let local;
    try {
      local = localDateParts(now, school.timezone || "Africa/Kinshasa");
    } catch {
      await reportOperationalIssue({
        source: "whatsapp-reminders",
        message: `Invalid school timezone: ${school.timezone}`,
        reference: school.id,
      });
      continue;
    }
    if (local.hour !== row.local_send_hour) continue;

    let students: EligibleStudentRow[];
    try {
      students = await collectAllPages<EligibleStudentRow>((from, to) =>
        admin
          .from("students")
          .select(`
            id, amount_due, balance_due_at, reminder_cycle_id, reminders_paused_until,
            reminder_stop_reason, created_at,
            student_guardians!inner (
              is_primary,
              guardians!inner (
                id, full_name, whatsapp_phone, preferred_locale,
                whatsapp_opt_in_at, whatsapp_opted_out_at
              )
            )
          `)
          .eq("school_id", school.id)
          .gt("amount_due", 0)
          .not("balance_due_at", "is", null)
          .not("reminder_cycle_id", "is", null)
          .eq("student_guardians.is_primary", true)
          .order("id")
          .range(from, to) as unknown as PromiseLike<{
            data: EligibleStudentRow[] | null;
            error?: { message?: string } | null;
          }>
      );
    } catch (error) {
      await reportOperationalIssue({
        source: "whatsapp-reminders",
        message: `Could not load eligible students: ${error instanceof Error ? error.message : "unknown error"}`,
        reference: school.id,
      });
      continue;
    }

    const studentIds = students.map((student) => student.id);
    const pendingStudents = new Set<string>();
    for (let index = 0; index < studentIds.length; index += 200) {
      const batch = studentIds.slice(index, index + 200);
      const { data: pending } = await admin
        .from("payment_requests")
        .select("student_id")
        .in("student_id", batch)
        .eq("status", "pending")
        .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());
      for (const payment of pending ?? []) pendingStudents.add(payment.student_id);
    }

    for (const student of students) {
      if (
        student.reminder_stop_reason ||
        pendingStudents.has(student.id) ||
        now.getTime() < new Date(student.created_at).getTime() + 24 * 60 * 60 * 1000 ||
        (student.reminders_paused_until && new Date(student.reminders_paused_until).getTime() > now.getTime())
      ) {
        continue;
      }

      const link = student.student_guardians?.[0] as unknown as {
        guardians: GuardianJoin | GuardianJoin[];
      } | undefined;
      const guardian = (Array.isArray(link?.guardians) ? link?.guardians[0] : link?.guardians) ?? null;
      if (!guardian?.whatsapp_opt_in_at || guardian.whatsapp_opted_out_at) continue;

      const stage = getReminderStage({
        now,
        dueAt: new Date(student.balance_due_at),
        timezone: school.timezone || "Africa/Kinshasa",
        maxReminders: row.max_reminders,
      });
      if (stage === null) continue;
      eligible += 1;
      if (dryRun) continue;

      const locale: WhatsAppLocale = "fr";
      const { error } = await admin.from("whatsapp_messages").insert({
        school_id: school.id,
        student_id: student.id,
        guardian_id: guardian.id,
        reminder_cycle_id: student.reminder_cycle_id,
        kind: "payment_reminder",
        stage,
        template_name: getWhatsAppTemplateName("payment_reminder", locale),
        locale,
        scheduled_for: now.toISOString(),
        amount_snapshot: student.amount_due,
        currency: school.currency,
      });

      if (!error) enqueued += 1;
      else if (error.code !== "23505") {
        await reportOperationalIssue({
          source: "whatsapp-reminders",
          severity: "warning",
          message: `Could not enqueue reminder: ${error.message}`,
          reference: student.id,
        });
      }
    }
  }

  return { eligible, enqueued, dryRun };
}

function displayStudentName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "—";
}

function amountText(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function dispatchQueuedWhatsAppMessages(limit = 50) {
  const admin = getAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc("claim_whatsapp_messages", {
    p_limit: limit,
  });
  if (claimError) throw new Error(`Could not claim WhatsApp messages: ${claimError.message}`);

  let accepted = 0;
  let failed = 0;
  let cancelled = 0;

  for (const message of claimed ?? []) {
    let createdLinkId: string | null = null;
    try {
      const [
        { data: student },
        { data: guardian },
        { data: school },
        { data: schoolSettings },
      ] = await Promise.all([
        admin
          .from("students")
          .select("id, full_name, amount_due, reminder_cycle_id, reminders_paused_until, reminder_stop_reason")
          .eq("id", message.student_id)
          .single(),
        admin
          .from("guardians")
          .select("id, full_name, whatsapp_phone, preferred_locale, whatsapp_opt_in_at, whatsapp_opted_out_at")
          .eq("id", message.guardian_id)
          .single(),
        admin
          .from("schools")
          .select("id, name, currency, status, verification_status")
          .eq("id", message.school_id)
          .single(),
        admin
          .from("school_whatsapp_settings")
          .select("automatic_reminders_enabled, paused_until")
          .eq("school_id", message.school_id)
          .maybeSingle(),
      ]);

      const requiresUnpaidBalance = message.kind !== "payment_confirmed";
      const studentPausedUntil = student?.reminders_paused_until
        ? new Date(student.reminders_paused_until)
        : null;
      const schoolPausedUntil = schoolSettings?.paused_until
        ? new Date(schoolSettings.paused_until)
        : null;
      const automationPaused =
        requiresUnpaidBalance &&
        (schoolSettings?.automatic_reminders_enabled === false ||
          (studentPausedUntil && studentPausedUntil.getTime() > Date.now()) ||
          (schoolPausedUntil && schoolPausedUntil.getTime() > Date.now()));

      if (automationPaused) {
        const resumeAt = [studentPausedUntil, schoolPausedUntil]
          .filter((date): date is Date => Boolean(date && date.getTime() > Date.now()))
          .sort((a, b) => a.getTime() - b.getTime())[0];
        await admin
          .from("whatsapp_messages")
          .update({
            status: "queued",
            attempt_count: Math.max(0, Number(message.attempt_count) - 1),
            scheduled_for: (resumeAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString(),
          })
          .eq("id", message.id);
        continue;
      }

      const invalid =
        !student ||
        !guardian ||
        !school ||
        school.status !== "active" ||
        school.verification_status !== "verified" ||
        !guardian.whatsapp_opt_in_at ||
        Boolean(guardian.whatsapp_opted_out_at) ||
        student.reminder_cycle_id !== message.reminder_cycle_id ||
        (requiresUnpaidBalance && Number(student.amount_due) <= 0) ||
        (requiresUnpaidBalance && Boolean(student.reminder_stop_reason));

      if (invalid) {
        await admin
          .from("whatsapp_messages")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "no_longer_eligible" })
          .eq("id", message.id);
        cancelled += 1;
        continue;
      }

      if (message.kind === "payment_reminder") {
        const { data: pending } = await admin
          .from("payment_requests")
          .select("id")
          .eq("student_id", student.id)
          .eq("status", "pending")
          .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (pending) {
          await admin
            .from("whatsapp_messages")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "payment_pending" })
            .eq("id", message.id);
          cancelled += 1;
          continue;
        }
      }

      let buttonToken: string | undefined;
      if (message.kind === "payment_reminder" || message.kind === "payment_failed") {
        const paymentLink = await createStudentPaymentLink({
          schoolId: school.id,
          studentId: student.id,
          reminderCycleId: message.reminder_cycle_id,
        });
        createdLinkId = paymentLink.id;
        buttonToken = paymentLink.token;
      } else if (message.kind === "payment_confirmed" && message.receipt_access_token) {
        buttonToken = message.receipt_access_token;
      }

      const locale: WhatsAppLocale = "fr";
      const kind = message.kind as WhatsAppMessageKind;
      const bodyParameters =
        kind === "payment_reminder"
          ? [
              guardian.full_name,
              school.name,
              displayStudentName(student.full_name),
              amountText(Number(student.amount_due)),
              school.currency,
            ]
          : [
              school.name,
              displayStudentName(student.full_name),
              amountText(Number(message.amount_snapshot)),
              school.currency,
            ];

      const result = await sendWhatsAppTemplate({
        to: guardian.whatsapp_phone,
        templateName: message.template_name,
        locale,
        bodyParameters,
        buttonToken,
      });

      await admin
        .from("whatsapp_messages")
        .update({
          status: "accepted",
          meta_message_id: result.messageId,
          payment_link_id: createdLinkId,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", message.id)
        .eq("status", "sending");
      accepted += 1;
    } catch (error) {
      if (createdLinkId) await revokeStudentPaymentLink(createdLinkId);
      const metaError = error instanceof MetaWhatsAppError ? error : null;
      const permanent = metaError ? !metaError.retryable : false;
      const attemptCount = permanent ? 3 : message.attempt_count;
      const delayMinutes = Math.min(60, 2 ** Math.max(0, message.attempt_count - 1) * 5);
      await admin
        .from("whatsapp_messages")
        .update({
          status: "failed",
          attempt_count: attemptCount,
          error_code: metaError?.code ?? "dispatch_error",
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown dispatch error",
          failed_at: new Date().toISOString(),
          scheduled_for: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
        })
        .eq("id", message.id);
      failed += 1;

      if (metaError?.code === "configuration_missing") {
        await reportOperationalIssue({
          source: "whatsapp-reminders",
          message: metaError.message,
          reference: message.id,
        });
      }
    }
  }

  return { claimed: claimed?.length ?? 0, accepted, failed, cancelled };
}
