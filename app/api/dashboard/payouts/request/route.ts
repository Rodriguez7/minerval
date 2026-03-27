import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const VALID_TELECOMS = new Set(["AM", "OM", "MP", "AF"]);
const MIN_AMOUNT = 1000;

export async function POST(req: NextRequest) {
  const { user, school, membership } = await getTenantContext();

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Seul le proprietaire de l'ecole peut demander un versement" }, { status: 403 });
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

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json(
      { error: `Le montant minimum est de ${MIN_AMOUNT}` },
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

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("request_school_payout", {
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

  return NextResponse.json(data, { status: 201 });
}
