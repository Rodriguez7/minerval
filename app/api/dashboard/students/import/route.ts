import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient, createSSRClient } from "@/lib/supabase";

const RowSchema = z.object({
  external_id: z.string().min(1).max(50),
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

  const admin = getAdminClient();
  const { data: school } = await admin
    .from("schools")
    .select("id")
    .eq("admin_email", user.email!)
    .single();
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 403 });

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

  const rows = parsed.data.rows.map((r) => ({ ...r, school_id: school.id }));

  const { data, error } = await admin
    .from("students")
    .upsert(rows, { onConflict: "school_id,external_id" })
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length ?? 0 });
}
