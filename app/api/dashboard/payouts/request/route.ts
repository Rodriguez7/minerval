import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";
import { MIN_PAYOUT_REQUEST_AMOUNT } from "@/lib/payout-fee";

const VALID_TELECOMS = new Set(["AM", "OM", "MP", "AF"]);

export async function POST(req: NextRequest) {
  const { user, school, membership } = await getTenantContext();

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Seul le proprietaire de l'ecole peut demander un versement" }, { status: 403 });
  }

  if (school.verification_status !== "verified") {
    return NextResponse.json(
      { error: "La verification de l'ecole est requise avant de demander un versement" },
      { status: 403 }
    );
  }

  let body: { amount?: unknown; phone?: unknown; telecom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const phone = String(body.phone ?? "").trim();
  const telecom = String(body.telecom ?? "").trim().toUpperCase();

  if (!Number.isSafeInteger(amount) || amount < MIN_PAYOUT_REQUEST_AMOUNT) {
    return NextResponse.json(
      { error: `Le montant minimum est de ${MIN_PAYOUT_REQUEST_AMOUNT}` },
      { status: 400 }
    );
  }

  if (!/^\d{9,15}$/.test(phone)) {
    return NextResponse.json({ error: "Le numero doit contenir entre 9 et 15 chiffres" }, { status: 400 });
  }

  if (!VALID_TELECOMS.has(telecom)) {
    return NextResponse.json(
      { error: "L'operateur doit etre AM, OM, MP ou AF" },
      { status: 400 }
    );
  }

  const supabase = await createSSRClient();
  const { data, error } = await supabase.rpc("request_school_payout", {
    p_school_id: school.id,
    p_requested_by: user.id,
    p_amount: amount,
    p_phone: phone,
    p_telecom: telecom,
  });

  if (error) {
    console.error("[payouts/request] RPC error:", error.message);
    return NextResponse.json({ error: "Impossible de creer la demande de versement" }, { status: 500 });
  }

  if (data?.error === "insufficient_balance") {
    return NextResponse.json(
      { error: "Solde insuffisant", available: data.available },
      { status: 422 }
    );
  }

  if (data?.error === "unauthorized") {
    return NextResponse.json({ error: "Versement non autorise" }, { status: 403 });
  }

  if (data?.error === "below_minimum" || data?.error === "invalid_amount") {
    return NextResponse.json(
      { error: `Le montant minimum est de ${MIN_PAYOUT_REQUEST_AMOUNT}` },
      { status: 400 }
    );
  }

  if (data?.error) {
    return NextResponse.json({ error: "Impossible de creer la demande de versement" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
