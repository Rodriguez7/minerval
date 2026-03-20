import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const RowSchema = z.object({
  external_id: z.string().min(1).max(50),
  amount_due: z.coerce.number().min(0),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const { school, plan } = await getTenantContext();

  if (!plan.can_bulk_ops) {
    return NextResponse.json(
      { error: "Bulk fee updates require a Pro plan." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const rows = parsed.data.rows;

  // Update each row individually — Supabase doesn't support batch UPDATE with
  // different values per row without an RPC, so use Promise.all for concurrency.
  const results = await Promise.all(
    rows.map(async (row) => {
      const { error } = await admin
        .from("students")
        .update({ amount_due: row.amount_due })
        .eq("school_id", school.id)
        .eq("external_id", row.external_id);
      return error ? null : row.external_id;
    })
  );

  const updated = results.filter(Boolean).length;
  const failed = rows.length - updated;

  return NextResponse.json({
    updated,
    ...(failed > 0 ? { errors: failed } : {}),
  });
}
