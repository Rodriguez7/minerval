import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const RowSchema = z.object({
  full_name: z.string().min(1).max(200),
  class_name: z.string().max(100).optional(),
  amount_due: z.coerce.number().min(0),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const { school, plan } = await getTenantContext();

  if (!plan.can_bulk_ops) {
    return NextResponse.json(
      { error: "CSV import requires a Pro plan." },
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

  const rowCount = parsed.data.rows.length;
  const admin = getAdminClient();

  // Enforce max_students cap if the plan has one (NULL = unlimited)
  if (plan.max_students !== null) {
    const { data: countData } = await admin
      .from("students")
      .select("count", { count: "exact", head: true })
      .eq("school_id", school.id)
      .single();

    const current = (countData as { count: number } | null)?.count ?? 0;
    if (current + rowCount > plan.max_students) {
      return NextResponse.json(
        {
          error: `Student limit reached. Your plan allows ${plan.max_students} students (currently ${current}).`,
        },
        { status: 400 }
      );
    }
  }

  // Atomically reserve `rowCount` sequential IDs for this school
  const { data: seq, error: seqError } = await admin
    .rpc("increment_student_seq", { p_school_id: school.id, p_count: rowCount }) as { data: { prefix: string; new_seq: number } | null; error: unknown };

  if (seqError || !seq) {
    return NextResponse.json({ error: "Failed to generate student IDs." }, { status: 500 });
  }

  const startSeq = seq.new_seq - rowCount + 1;
  const rows = parsed.data.rows.map((r, i) => ({
    ...r,
    school_id: school.id,
    external_id: `${seq.prefix}-${String(startSeq + i).padStart(3, "0")}`,
  }));

  const { data, error } = await admin.from("students").insert(rows).select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length ?? 0 });
}
