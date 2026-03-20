import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dashboard/students/bulk-fee/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const fromMock = vi.fn();
const adminMock = { from: fromMock };

function makeRequest(rows: unknown[]) {
  return new NextRequest(
    "http://localhost/api/dashboard/students/bulk-fee",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    }
  );
}

const PRO_CONTEXT = {
  school: { id: "school1" },
  membership: { role: "admin" },
  plan: { can_bulk_ops: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminClient).mockReturnValue(adminMock as never);
});

describe("POST /api/dashboard/students/bulk-fee", () => {
  it("returns 403 when can_bulk_ops is false", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...PRO_CONTEXT,
      plan: { can_bulk_ops: false },
    } as never);

    const res = await POST(
      makeRequest([{ external_id: "TST-001", amount_due: 5000 }])
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/pro plan/i);
  });

  it("returns 400 for empty rows array", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);

    const res = await POST(makeRequest([]));

    expect(res.status).toBe(400);
  });

  it("updates students and returns count", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);

    // Each row triggers: from("students").update().eq(school_id).eq(external_id)
    const makeUpdateChain = () => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    fromMock
      .mockReturnValueOnce(makeUpdateChain())
      .mockReturnValueOnce(makeUpdateChain());

    const res = await POST(
      makeRequest([
        { external_id: "TST-001", amount_due: 5000 },
        { external_id: "TST-002", amount_due: 3000 },
      ])
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(2);
  });
});
