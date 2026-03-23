import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const VALID_TELECOMS = new Set(["AM", "OM", "MP", "AF"]);
const MIN_AMOUNT = 1000;

export async function POST(req: NextRequest) {
  const { user, school, membership } = await getTenantContext();

  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only school owners can request payouts" }, { status: 403 });
  }

  let body: { amount?: unknown; phone?: unknown; telecom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const phone = String(body.phone ?? "").trim();
  const telecom = String(body.telecom ?? "").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be at least ${MIN_AMOUNT}` },
      { status: 400 }
    );
  }

  if (!/^\d{9,15}$/.test(phone)) {
    return NextResponse.json({ error: "Phone must be 9 to 15 digits" }, { status: 400 });
  }

  if (!VALID_TELECOMS.has(telecom)) {
    return NextResponse.json(
      { error: "Telecom must be one of AM, OM, MP, AF" },
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
    return NextResponse.json({ error: "Failed to create payout request" }, { status: 500 });
  }

  if (data?.error === "insufficient_balance") {
    return NextResponse.json(
      { error: "Insufficient balance", available: data.available },
      { status: 422 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
