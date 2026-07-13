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

const mockContext = {
  user: { id: "user-uuid", email: "owner@test.com" },
  school: { id: "school-uuid", name: "Test School", currency: "FC", verification_status: "verified" },
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

  it("returns 400 if the net payout would be below SerdiPay's minimum", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 1030, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if amount is not a whole currency unit", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 5000.5, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if telecom is invalid", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "ZZ" }));
    expect(res.status).toBe(400);
  });

  it("returns French 422 if RPC returns insufficient_balance", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { error: "insufficient_balance", available: 2000 },
      error: null,
    });
    vi.mocked(createSSRClient).mockResolvedValue({ rpc: mockRpc } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Solde insuffisant");
  });

  it("returns 403 if the database rejects payout authorization", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { error: "unauthorized" },
      error: null,
    });
    vi.mocked(createSSRClient).mockResolvedValue({ rpc: mockRpc } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(403);
  });

  it("returns 201 with payout id on success", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce(mockContext as never);
    const mockRpc = vi.fn().mockResolvedValueOnce({
      data: { id: "payout-uuid", status: "pending", amount: 5000, fee_amount: 150, net_amount: 4850 },
      error: null,
    });
    vi.mocked(createSSRClient).mockResolvedValue({ rpc: mockRpc } as never);

    const res = await POST(makeRequest({ amount: 5000, phone: "0812345678", telecom: "OM" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("payout-uuid");
    expect(body.status).toBe("pending");
    expect(body.fee_amount).toBe(150);
    expect(body.net_amount).toBe(4850);
  });
});
