import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/tenant", () => ({ getTenantContext: vi.fn() }));

import { POST } from "../app/api/dashboard/payouts/request/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { getTenantContext } from "../lib/tenant";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/dashboard/payouts/request", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function asAdminClient(client: { rpc: unknown }) {
  return client as unknown as AdminClient;
}

const mockContext = {
  user: { id: "user-uuid", email: "owner@test.com" },
  school: { id: "school-uuid", name: "Test School", currency: "FC" },
  membership: { role: "owner" },
};

describe("POST /api/dashboard/payouts/request", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 403 if role is not owner", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      ...mockContext,
      membership: { role: "admin" },
    } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 if amount < 1000", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 500, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if telecom is invalid", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "ZZ" }));
    expect(res.status).toBe(400);
  });

  it("returns 422 if RPC returns insufficient_balance", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { error: "insufficient_balance", available: 2000 },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ rpc: mockRpc }));

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient/i);
  });

  it("returns 201 with payout id on success", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { id: "payout-uuid", status: "pending" },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ rpc: mockRpc }));

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("payout-uuid");
    expect(body.status).toBe("pending");
  });
});
