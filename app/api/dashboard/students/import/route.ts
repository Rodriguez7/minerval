import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantContext } from "@/lib/tenant";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { normalizeDrcMobilePhone } from "@/lib/phone";

const RowSchema = z.object({
  full_name: z.string().min(1).max(200),
  class_name: z.string().max(100).optional(),
  amount_due: z.coerce.number().min(0),
  balance_due_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guardian_name: z.string().min(1).max(200),
  guardian_whatsapp: z.string().transform((value, ctx) => {
    const normalized = normalizeDrcMobilePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Numero WhatsApp RDC invalide" });
      return z.NEVER;
    }
    return normalized;
  }),
  guardian_relationship: z.enum(["parent", "guardian", "payer"]),
  whatsapp_consent: z.literal(true),
}).refine((row) => row.amount_due === 0 || Boolean(row.balance_due_at), {
  message: "La date d'echeance est obligatoire lorsque le montant du est superieur a zero",
  path: ["balance_due_at"],
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const { school, plan, membership } = await getTenantContext();

  if (!["owner", "admin", "finance"].includes(membership.role)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (!plan.can_bulk_ops) {
    return NextResponse.json(
      { error: "L'import CSV exige un plan Pro." },
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

  const rowCount = parsed.data.rows.length;
  const admin = getAdminClient();

  // Enforce max_students cap if the plan has one (NULL = unlimited)
  if (plan.max_students !== null) {
    const { count: currentCount } = await admin
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", school.id);

    const current = currentCount ?? 0;
    if (current + rowCount > plan.max_students) {
      return NextResponse.json(
        {
          error: `Limite d'eleves atteinte. Votre plan autorise ${plan.max_students} eleves (actuellement ${current}).`,
        },
        { status: 400 }
      );
    }
  }

  const supabase = await createSSRClient();
  const { data, error } = await supabase.rpc("import_students_with_guardians", {
    p_school_id: school.id,
    p_rows: parsed.data.rows.map((row) => ({
      full_name: row.full_name,
      class_name: row.class_name ?? "",
      amount_due: row.amount_due,
      balance_due_at: `${row.balance_due_at}T00:00:00.000Z`,
      guardian_name: row.guardian_name,
      guardian_phone: row.guardian_whatsapp,
      guardian_relationship: row.guardian_relationship,
      guardian_locale: "fr",
    })),
  });

  const result = data as { imported?: number; error?: string } | null;
  if (error || result?.error) {
    return NextResponse.json(
      { error: error?.message ?? result?.error ?? "Echec de l'import" },
      { status: 500 }
    );
  }

  return NextResponse.json({ imported: result?.imported ?? 0 });
}
