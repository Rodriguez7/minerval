import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  getAdminClient: vi.fn(),
}));

import { POST } from "../app/api/serdipay/callback/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/serdipay/callback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const mockPendingPayment = {
  id: "pay-uuid",
  student_id: "student-uuid",
  amount: 15000,
  status: "pending",
};

// SerdiPay success callback shape
const successCallback = {
  status: 200,
  message: "pay-uuid",
  payment: { status: "success", sessionId: "123", sessionStatus: 3, transactionId: "SERDMG7MW6ZV" },
};

// SerdiPay failed callback shape
const failedCallback = {
  message: "pay-uuid",
  payment: { status: "failed", sessionId: "123", sessionStatus: 3, transactionId: "SERDMG7MW6ZV" },
};

describe("POST /api/serdipay/callback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 if message or payment is missing", async () => {
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn() } as any);
    const res = await POST(makeRequest({ status: 200 }));
    expect(res.status).toBe(400);
  });

  it("returns 200 if already processed (idempotency)", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockPendingPayment, status: "success" },
        error: null,
      }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(successCallback));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/already processed/i);
  });

  it("stores transactionId and sets amount_due to 0 on success", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPendingPayment, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

    vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(successCallback));
    expect(res.status).toBe(200);

    // payment_requests update (index 1) includes transactionId
    const paymentUpdate = mockFrom.mock.results[1].value;
    expect(paymentUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        serdipay_transaction_id: "SERDMG7MW6ZV",
      })
    );

    // student update (index 3) sets amount_due to 0
    const studentUpdate = mockFrom.mock.results[3].value;
    expect(studentUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount_due: 0 })
    );
  });

  it("marks failed without updating student", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPendingPayment, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(failedCallback));
    expect(res.status).toBe(200);
    // 3 from() calls: lookup, update payment, insert event — no student update
    expect(mockFrom.mock.calls.length).toBe(3);
  });
});
