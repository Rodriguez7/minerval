import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { POST } from "../app/api/serdipay/callback/route";
import { NextRequest } from "next/server";
import { supabase } from "../lib/supabase";

const mockFrom = vi.mocked(supabase.from);

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
    const res = await POST(makeRequest({ status: 200 }));
    expect(res.status).toBe(400);
  });

  it("returns 200 if already processed (idempotency)", async () => {
    (mockFrom as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { ...mockPendingPayment, status: "success" },
        error: null,
      }),
    });

    const res = await POST(makeRequest(successCallback));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/already processed/i);
  });

  it("stores transactionId and sets amount_due to 0 on success", async () => {
    (mockFrom as any)
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
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

    const res = await POST(makeRequest(successCallback));
    expect(res.status).toBe(200);

    // payment_requests update includes transactionId
    const paymentUpdate = (mockFrom as any).mock.results[1].value;
    expect(paymentUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        serdipay_transaction_id: "SERDMG7MW6ZV",
      })
    );

    // student update sets amount_due to 0
    const studentUpdate = (mockFrom as any).mock.results[2].value;
    expect(studentUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount_due: 0 })
    );
  });

  it("marks failed without updating student", async () => {
    (mockFrom as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPendingPayment, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

    const res = await POST(makeRequest(failedCallback));
    expect(res.status).toBe(200);
    // Only 2 from() calls — no student update
    expect((mockFrom as any).mock.calls.length).toBe(2);
  });
});
