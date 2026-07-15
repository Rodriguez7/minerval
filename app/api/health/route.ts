import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { secureCompare } from "@/lib/secure-compare";
import { getEmailConfigurationIssues } from "@/lib/email-config";

export const dynamic = "force-dynamic";

const REQUIRED_PRODUCTION_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "PROXY_URL",
  "PROXY_SECRET",
  "SERDIPAY_CALLBACK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_DOMAIN",
  "OPERATIONS_ALERT_EMAIL",
  "LEGAL_ENTITY_NAME",
  "LEGAL_CONTACT_EMAIL",
  "PRIVACY_CONTACT_EMAIL",
] as const;
const EXPECTED_NODE_MAJOR = 22;

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("deep") === "1") {
    return deepHealth(request);
  }

  return NextResponse.json({
    service: "minerval",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

async function deepHealth(request: NextRequest) {
  const expectedSecret = process.env.HEALTHCHECK_SECRET;
  const receivedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureCompare(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missingConfiguration = REQUIRED_PRODUCTION_ENV.filter(
    (name) => !process.env[name]?.trim()
  );

  const [database, proxy] = await Promise.all([checkDatabase(), checkProxy()]);
  const emailIssues = getEmailConfigurationIssues();
  const runtime = checkRuntime();
  const healthy =
    database.ok &&
    proxy.ok &&
    runtime.ok &&
    missingConfiguration.length === 0 &&
    emailIssues.length === 0;

  return NextResponse.json(
    {
      service: "minerval",
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        proxy,
        runtime,
        configuration: {
          ok: missingConfiguration.length === 0,
          missing: missingConfiguration,
        },
        email: {
          ok: emailIssues.length === 0,
          issues: emailIssues,
        },
      },
    },
    { status: healthy ? 200 : 503 }
  );
}

function checkRuntime() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  return {
    ok: major === EXPECTED_NODE_MAJOR,
    expected_node_major: EXPECTED_NODE_MAJOR,
    actual_node_major: Number.isFinite(major) ? major : null,
  };
}

async function checkDatabase() {
  try {
    const { error } = await getAdminClient().from("schools").select("id").limit(1);
    return error ? { ok: false, error: "query_failed" } : { ok: true };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

async function checkProxy() {
  const proxyUrl = process.env.PROXY_URL?.replace(/\/$/, "");
  if (!proxyUrl) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch(`${proxyUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return response.ok ? { ok: true } : { ok: false, error: `http_${response.status}` };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}
