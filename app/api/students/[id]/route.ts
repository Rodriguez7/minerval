import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await getAdminClient()
    .from("students")
    .select("external_id, full_name, amount_due, schools(name, code)")
    .eq("external_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const school = data.schools as unknown as { name: string; code: string } | null;

  return NextResponse.json({
    student_id: data.external_id,
    full_name: data.full_name,
    school_name: school?.name ?? "Unknown School",
    school_code: school?.code ?? "",
    amount_due: data.amount_due,
  });
}
