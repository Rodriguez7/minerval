import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const RowSchema = z.object({
  external_id: z.string().min(1).max(50),
  amount_due: z.coerce.number().min(0),
  balance_due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((row) => row.amount_due === 0 || Boolean(row.balance_due_at), {
  message: "La date d'echeance est obligatoire lorsque le montant du est superieur a zero",
  path: ["balance_due_at"],
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const { school, plan } = await getTenantContext();

  if (!plan.can_bulk_ops) {
    return NextResponse.json(
      { error: "La mise a jour groupee des frais exige un plan Pro." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Erreur de validation" },
      { status: 400 }
    );
  }

  const admin = getAdminClient();
  const rows = parsed.data.rows;

  // Update each row individually — Supabase doesn't support batch UPDATE with
  // different values per row without an RPC, so use Promise.all for concurrency.
  const results = await Promise.all(
    rows.map(async (row) => {
      const { data, error } = await admin.rpc("replace_student_balance_cycle", {
        p_school_id: school.id,
        p_external_id: row.external_id,
        p_amount_due: row.amount_due,
        p_balance_due_at: `${row.balance_due_at}T00:00:00.000Z`,
      });
      return error || data !== true ? null : row.external_id;
    })
  );

  const updated = results.filter(Boolean).length;
  const failed = rows.length - updated;

  return NextResponse.json({
    updated,
    ...(failed > 0 ? { errors: failed } : {}),
  });
}
