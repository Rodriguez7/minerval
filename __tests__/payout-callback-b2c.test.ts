import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendPayoutCompletedEmail: vi.fn(),
  sendPayoutFailedEmail: vi.fn(),
}));

import { POST } from "../app/api/serdipay/payout-callback/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "../lib/email";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(body: object, secret = "test-callback-secret") {
  return new NextRequest("http://localhost/api/serdipay/payout-callback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-serdipay-secret": secret,
    },
  });
}

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

const mockPayout = {
  id: "payout-uuid",
  school_id: "school-uuid",
  requested_by: "user-uuid",
  amount: 5000,
  phone: "0812345678",
  telecom: "OM",
  status: "processing",
};

describe("POST /api/serdipay/payout-callback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 if callback secret is wrong", async () => {
    const res = await POST(makeRequest({ message: "payout-uuid" }, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 for unknown payout id (idempotent ignore)", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({ message: "unknown-id", payment: { status: "success" } }));
    expect(res.status).toBe(200);
  });

  it("marks completed and sends success email on success callback", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({
      message: "payout-uuid",
      payment: { status: "success", transactionId: "TXN123" },
    }));
    expect(res.status).toBe(200);
    expect(sendPayoutCompletedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@test.com", amount: 5000 })
    );
  });

  it("marks failed and sends failure email on failed callback", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest({
      message: "payout-uuid",
      payment: { status: "failed" },
    }));
    expect(res.status).toBe(200);
    expect(sendPayoutFailedEmail).toHaveBeenCalled();
  });
});
