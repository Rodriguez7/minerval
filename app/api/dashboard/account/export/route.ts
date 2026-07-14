import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { consumeRateLimit } from "@/lib/rate-limit";
import { buildSchoolExport } from "@/lib/school-export";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, school, membership } = await getTenantContext();
  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Seul le proprietaire peut exporter toutes les donnees de l'ecole." },
      { status: 403 }
    );
  }

  const rateLimit = await consumeRateLimit({
    key: `school-export:${school.id}:${user.id}`,
    limit: 2,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Export temporairement limite. Reessayez dans ${rateLimit.retryAfterSeconds} secondes.` },
      { status: 429 }
    );
  }

  try {
    const data = await buildSchoolExport(getAdminClient(), school.id);
    const safeCode = school.code.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="minerval-${safeCode}-export.json"`,
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "[school-export] failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json({ error: "Impossible de generer l'export." }, { status: 500 });
  }
}
