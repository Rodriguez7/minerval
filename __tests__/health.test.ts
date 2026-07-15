import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";
import { getAdminClient } from "@/lib/supabase";

const requiredEnvironment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_KEY: "service",
  PROXY_URL: "https://proxy.minerval.org",
  PROXY_SECRET: "proxy-secret",
  SERDIPAY_CALLBACK_SECRET: "callback-secret",
  STRIPE_SECRET_KEY: "sk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_GROWTH_MONTHLY: "price_growth",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro",
  RESEND_API_KEY: "re_example",
  EMAIL_FROM: "Minerval <no-reply@minerval.org>",
  EMAIL_DOMAIN: "minerval.org",
  OPERATIONS_ALERT_EMAIL: "ops@minerval.org",
  HEALTHCHECK_SECRET: "health-secret",
  LEGAL_ENTITY_NAME: "Minerval Test SARL",
  LEGAL_ENTITY_ADDRESS: "Kinshasa, RDC",
  LEGAL_CONTACT_EMAIL: "support@minerval.org",
  PRIVACY_CONTACT_EMAIL: "privacy@minerval.org",
};

function request(deep = false, secret?: string) {
  return new NextRequest(`http://localhost/api/health${deep ? "?deep=1" : ""}`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("health endpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.assign(process.env, requiredEnvironment);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    vi.mocked(getAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as never);
  });

  it("keeps the public liveness response shallow", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("checks");
  });

  it("protects the deep health response", async () => {
    expect((await GET(request(true))).status).toBe(401);
    expect((await GET(request(true, "wrong"))).status).toBe(401);
  });

  it("reports all dependencies healthy", async () => {
    const response = await GET(request(true, "health-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      checks: {
        database: { ok: true },
        proxy: { ok: true },
        runtime: {
          ok: true,
          expected_node_major: 22,
          actual_node_major: 22,
        },
        configuration: { ok: true, missing: [] },
        email: { ok: true, issues: [] },
      },
    });
  });

  it("does not degrade when the legal address is intentionally unpublished", async () => {
    delete process.env.LEGAL_ENTITY_ADDRESS;

    const response = await GET(request(true, "health-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      checks: {
        configuration: { ok: true, missing: [] },
      },
    });
  });

  it("returns 503 when sender and public contact domains disagree", async () => {
    process.env.EMAIL_FROM = "Minerval <no-reply@minerval.app>";

    const response = await GET(request(true, "health-secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      checks: {
        email: {
          ok: false,
          issues: ["EMAIL_FROM does not use EMAIL_DOMAIN"],
        },
      },
    });
  });

  it("returns 503 when a dependency or required setting is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 502 })));

    const response = await GET(request(true, "health-secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "degraded",
      checks: {
        proxy: { ok: false, error: "http_502" },
        configuration: { ok: false, missing: ["STRIPE_WEBHOOK_SECRET"] },
      },
    });
  });
});
