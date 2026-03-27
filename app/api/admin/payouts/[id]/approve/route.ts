import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { callProxyPayout, ProxyError } from "@/lib/proxy";
import { sendPayoutFailedEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user } = await getTenantContext();

  if (user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const admin = getAdminClient();

  // Atomic re-entrancy guard: only succeeds if status is still 'pending'
  const { data: payout } = await admin
    .from("school_payouts")
    .update({
      status: "processing",
      approved_at: new Date().toISOString(),
      approved_by: user.email,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (!payout) {
    return NextResponse.json(
      { error: "Versement introuvable ou deja traite" },
      { status: 409 }
    );
  }

  const secret = process.env.SERDIPAY_CALLBACK_SECRET ?? "";
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/serdipay/payout-callback?secret=${encodeURIComponent(secret)}`;

  try {
    await callProxyPayout({
      amount: payout.amount,
      phone: payout.phone,
      telecom: payout.telecom,
      reference: payout.id,
      callback_url: callbackUrl,
    });

    return NextResponse.json({ id: payout.id, status: "processing" });
  } catch (err) {
    const reason = err instanceof ProxyError ? err.message : "Erreur proxy inattendue";

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", payout.requested_by)
      .single();

    const { data: school } = await admin
      .from("schools")
      .select("currency")
      .eq("id", payout.school_id)
      .single();

    await admin
      .from("school_payouts")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", payout.id);

    const ownerEmail = (profile as { email?: string } | null)?.email;
    const currency = (school as { currency?: string } | null)?.currency ?? "";

    if (ownerEmail) {
      await Promise.resolve(
        sendPayoutFailedEmail({
          to: ownerEmail,
          amount: payout.amount,
          currency,
          phone: payout.phone,
          telecom: payout.telecom,
        })
      ).catch(console.error);
    }

    const status = err instanceof ProxyError ? err.status : 500;
    return NextResponse.json({ error: reason }, { status });
  }
}
