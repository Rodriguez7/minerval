import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "@/lib/email";

const ResolutionSchema = z
  .object({
    resolution: z.enum(["completed", "failed"]),
    note: z.string().trim().min(10).max(500),
    transaction_id: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === "completed" && !value.transaction_id) {
      ctx.addIssue({
        code: "custom",
        path: ["transaction_id"],
        message: "L'identifiant de transaction SerdiPay est obligatoire.",
      });
    }
  });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getTenantContext();
  if (!process.env.SUPER_ADMIN_EMAIL || user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = ResolutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Resolution invalide" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const admin = getAdminClient();
  const now = new Date().toISOString();
  const auditNote = `Resolution manuelle par ${user.email} : ${parsed.data.note}`;
  const update =
    parsed.data.resolution === "completed"
      ? {
          status: "completed",
          completed_at: now,
          serdipay_transaction_id: parsed.data.transaction_id,
          failure_reason: auditNote,
        }
      : {
          status: "failed",
          failure_reason: auditNote,
        };

  const { data: payout, error } = await admin
    .from("school_payouts")
    .update(update)
    .eq("id", id)
    .eq("status", "processing")
    .select("id, requested_by, net_amount, phone, telecom, school_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Impossible de resoudre le versement" }, { status: 500 });
  }
  if (!payout) {
    return NextResponse.json(
      { error: "Versement introuvable ou deja resolu" },
      { status: 409 }
    );
  }

  const [{ data: profile }, { data: school }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", payout.requested_by).maybeSingle(),
    admin.from("schools").select("currency").eq("id", payout.school_id).maybeSingle(),
  ]);
  const ownerEmail = (profile as { email?: string } | null)?.email;
  const currency = (school as { currency?: string } | null)?.currency ?? "";

  if (ownerEmail) {
    const send =
      parsed.data.resolution === "completed"
        ? sendPayoutCompletedEmail({
            to: ownerEmail,
            amount: payout.net_amount,
            currency,
            phone: payout.phone,
            telecom: payout.telecom,
          })
        : sendPayoutFailedEmail({
            to: ownerEmail,
            amount: payout.net_amount,
            currency,
            phone: payout.phone,
            telecom: payout.telecom,
          });
    await Promise.resolve(send).catch(console.error);
  }

  return NextResponse.json({ id: payout.id, status: parsed.data.resolution });
}
