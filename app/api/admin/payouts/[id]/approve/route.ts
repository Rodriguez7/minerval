import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { callProxyPayout, ProxyError } from "@/lib/proxy";
import { buildSerdiPayCallbackUrl } from "@/lib/serdipay";
import { reportOperationalIssue } from "@/lib/operations";

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

  let callbackUrl: string;
  try {
    callbackUrl = buildSerdiPayCallbackUrl("/api/serdipay/payout-callback");
  } catch {
    await admin
      .from("school_payouts")
      .update({ status: "failed", failure_reason: "Configuration du callback de versement manquante" })
      .eq("id", payout.id);

    await reportOperationalIssue({
      source: "payout-approval",
      severity: "warning",
      message: "SerdiPay response was ambiguous; payout remains reserved for manual verification.",
      reference: payout.id,
    });

    return NextResponse.json(
      { error: "Configuration du callback de versement manquante" },
      { status: 503 }
    );
  }

  try {
    await callProxyPayout({
      amount: payout.net_amount,
      phone: payout.phone,
      telecom: payout.telecom,
      reference: payout.id,
      callback_url: callbackUrl,
    });

    return NextResponse.json({ id: payout.id, status: "processing" });
  } catch (err) {
    const reason = err instanceof ProxyError ? err.message : "Erreur proxy inattendue";
    const isDefinitiveRejection =
      err instanceof ProxyError && err.status >= 400 && err.status < 500;

    if (isDefinitiveRejection) {
      await admin
        .from("school_payouts")
        .update({ status: "failed", failure_reason: reason })
        .eq("id", payout.id);

      return NextResponse.json({ error: reason }, { status: err.status });
    }

    // Timeouts and upstream failures are ambiguous: the payout may have been
    // accepted already. Keep the balance reserved until the signed callback or
    // a manual reconciliation confirms the final outcome.
    await admin
      .from("school_payouts")
      .update({
        failure_reason: `Confirmation SerdiPay requise: ${reason}`,
      })
      .eq("id", payout.id);

    return NextResponse.json(
      {
        id: payout.id,
        status: "processing",
        error: "Reponse SerdiPay incertaine; le versement reste reserve pour verification.",
      },
      { status: 202 }
    );
  }
}
