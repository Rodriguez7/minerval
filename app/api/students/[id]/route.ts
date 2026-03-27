import { NextRequest, NextResponse } from "next/server";
import { getSchoolByPaymentAccessToken } from "@/lib/payment-access";
import { getClientIp } from "@/lib/request";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const paymentToken = req.nextUrl.searchParams.get("payment_token");

  if (!paymentToken) {
    return NextResponse.json({ error: "payment_token est obligatoire" }, { status: 400 });
  }

  const school = await getSchoolByPaymentAccessToken(paymentToken);
  if (!school) {
    return NextResponse.json({ error: "Lien de paiement introuvable" }, { status: 404 });
  }

  const rateLimit = consumeRateLimit({
    key: `students-api:${school.id}:${getClientIp(req.headers)}`,
    limit: 15,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Trop de tentatives de recherche. Attendez ${rateLimit.retryAfterSeconds} secondes puis reessayez.`,
      },
      { status: 429 }
    );
  }

  const { data, error } = await getAdminClient()
    .from("students")
    .select("external_id, full_name, amount_due")
    .eq("school_id", school.id)
    .eq("external_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Eleve introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    student_id: data.external_id,
    full_name: data.full_name,
    school_name: school.name,
    school_code: school.code,
    amount_due: data.amount_due,
  });
}
