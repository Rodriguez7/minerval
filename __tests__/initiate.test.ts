import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("../lib/proxy", () => ({
  callProxy: vi.fn(),
  ProxyError: class ProxyError extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.status = status; }
  },
}));

import { POST } from "../app/api/payments/initiate/route";
import { NextRequest } from "next/server";
import { supabase } from "../lib/supabase";
import { callProxy } from "../lib/proxy";

const mockFrom = vi.mocked(supabase.from);
const mockCallProxy = vi.mocked(callProxy);

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/payments/initiate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const mockStudent = {
  id: "student-uuid",
  school_id: "school-uuid",
  name: "Jean Kabila",
  amount_due: 15000,
  external_id: "STU-001",
};

describe("POST /api/payments/initiate", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 400 if student_id, phone, or telecom is missing", async () => {
    const res = await POST(makeRequest({ student_id: "STU-001", phone: "243812345678" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/telecom/i);
  });

  it("returns 400 for invalid telecom code", async () => {
    const res = await POST(makeRequest({ student_id: "STU-001", phone: "243812345678", telecom: "INVALID" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 if student not found", async () => {
    (mockFrom as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });

    const res = await POST(makeRequest({ student_id: "STU-999", phone: "243812345678", telecom: "AM" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 with 'no fees' message if amount_due is 0", async () => {
    (mockFrom as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...mockStudent, amount_due: 0 }, error: null }),
    });

    const res = await POST(makeRequest({ student_id: "STU-001", phone: "243812345678", telecom: "AM" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no fees/i);
  });

  it("creates payment_request with telecom, calls proxy, returns pending", async () => {
    (mockFrom as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "pay-uuid" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

    mockCallProxy.mockResolvedValue({ payment: { sessionId: "123" } });

    const res = await POST(makeRequest({ student_id: "STU-001", phone: "243812345678", telecom: "AM" }));
    expect(res.status).toBe(200);
    expect(mockCallProxy).toHaveBeenCalledWith(
      expect.objectContaining({ telecom: "AM", phone: "243812345678" })
    );
  });

  it("returns 409 with SerdiPay duplicate message", async () => {
    (mockFrom as any)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "pay-uuid" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

    const { ProxyError } = await import("../lib/proxy");
    mockCallProxy.mockRejectedValue(
      new ProxyError("A simular transaction is already in process, Please Wait for 2 minutes", 409)
    );

    const res = await POST(makeRequest({ student_id: "STU-001", phone: "243812345678", telecom: "AM" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/2 minutes/i);
  });
});
