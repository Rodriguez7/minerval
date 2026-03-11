import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("students")
    .select("external_id, name, amount_due, schools(name)")
    .eq("external_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({
    student_id: data.external_id,
    name: data.name,
    school_name: (data.schools as { name: string } | null)?.name ?? "Unknown School",
    amount_due: data.amount_due,
  });
}
