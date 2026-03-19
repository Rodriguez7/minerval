import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSSRClient } from "@/lib/supabase";

const RowSchema = z.object({
  full_name: z.string().min(1).max(200),
  class_name: z.string().max(100).optional(),
  amount_due: z.coerce.number().min(0),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const ssrClient = await createSSRClient();
  const {
    data: { user },
  } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await ssrClient
    .from("school_memberships")
    .select("school_id")
    .eq("status", "active")
    .single();

  if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const schoolId = membership.school_id;

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

  const count = parsed.data.rows.length;

  // Atomically reserve `count` sequential IDs for this school
  const { data: seq, error: seqError } = await ssrClient
    .rpc("increment_student_seq", { p_school_id: schoolId, p_count: count })
    .single() as { data: { prefix: string; new_seq: number } | null; error: unknown };

  if (seqError || !seq) {
    return NextResponse.json({ error: "Failed to generate student IDs." }, { status: 500 });
  }

  const startSeq = seq.new_seq - count + 1;
  const rows = parsed.data.rows.map((r, i) => ({
    ...r,
    school_id: schoolId,
    external_id: `${seq.prefix}-${String(startSeq + i).padStart(3, "0")}`,
  }));

  const { data, error } = await ssrClient.from("students").insert(rows).select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length ?? 0 });
}
