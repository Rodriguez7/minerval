import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ createSSRClient: vi.fn() }));
vi.mock("../lib/tenant", () => ({ getTenantContext: vi.fn() }));

import { POST } from "../app/api/dashboard/payouts/request/route";
import { NextRequest } from "next/server";
import { createSSRClient } from "../lib/supabase";
import { getTenantContext } from "../lib/tenant";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/dashboard/payouts/request", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const baseContext = {
  user: { id: "owner-uuid", email: "owner@test.com" },
  school: {
    id: "school-uuid",
    name: "Test School",
    currency: "FC",
    verification_status: "unverified",
  },
  membership: { role: "owner" },
};

describe("school verification payout gating", () => {
  beforeEach(() => vi.resetAllMocks());

  it("blocks payout requests until the school is verified", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(baseContext as never);
    const rpc = vi.fn();
    vi.mocked(createSSRClient).mockResolvedValue({ rpc } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("verification");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows payout requests for verified schools", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      ...baseContext,
      school: { ...baseContext.school, verification_status: "verified" },
    } as never);
    const rpc = vi.fn().mockResolvedValueOnce({ data: { id: "payout-uuid", status: "pending" }, error: null });
    vi.mocked(createSSRClient).mockResolvedValue({ rpc } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));

    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
