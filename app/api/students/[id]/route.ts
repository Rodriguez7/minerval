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
    return NextResponse.json({ error: "payment_token is required" }, { status: 400 });
  }

  const school = await getSchoolByPaymentAccessToken(paymentToken);
  if (!school) {
    return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
  }

  const rateLimit = consumeRateLimit({
    key: `students-api:${school.id}:${getClientIp(req.headers)}`,
    limit: 15,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many lookup attempts. Please wait ${rateLimit.retryAfterSeconds} seconds and try again.`,
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
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({
    student_id: data.external_id,
    full_name: data.full_name,
    school_name: school.name,
    school_code: school.code,
    amount_due: data.amount_due,
  });
}
