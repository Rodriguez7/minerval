import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  getAdminClient: vi.fn(),
}));

vi.mock("../lib/proxy", () => ({
  callProxy: vi.fn(),
  ProxyError: class ProxyError extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.status = status; }
  },
}));

vi.mock("../lib/payment-access", () => ({
  getSchoolByPaymentAccessToken: vi.fn(),
}));

import { POST } from "../app/api/payments/initiate/route";
import { NextRequest } from "next/server";
import { getSchoolByPaymentAccessToken } from "../lib/payment-access";
import { getAdminClient } from "../lib/supabase";
import { callProxy } from "../lib/proxy";

type AdminClient = ReturnType<typeof getAdminClient>;

const mockCallProxy = vi.mocked(callProxy);

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/payments/initiate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

const mockStudent = {
  id: "student-uuid",
  school_id: "school-uuid",
  full_name: "Jean Kabila",
  amount_due: 15000,
  external_id: "STU-001",
};

describe("POST /api/payments/initiate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSchoolByPaymentAccessToken).mockResolvedValue({
      id: "school-uuid",
      name: "École Test",
      code: "ecole-test",
      payment_access_token: "school-token",
      currency: "FC" as const,
      logo_url: null,
    });
  });

  it("returns 400 if student_id, phone, or telecom is missing", async () => {
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: vi.fn() }));
    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/telecom/i);
  });

  it("returns 400 for invalid telecom code", async () => {
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: vi.fn() }));
    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        telecom: "INVALID",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 if the payment token is invalid", async () => {
    vi.mocked(getSchoolByPaymentAccessToken).mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        telecom: "AM",
        payment_token: "bad-token",
      })
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 if student not found", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(
      makeRequest({
        student_id: "STU-999",
        phone: "243812345678",
        telecom: "AM",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns French 400 message when amount_due is 0", async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { ...mockStudent, amount_due: 0 }, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        telecom: "AM",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Aucun frais en attente pour cet eleve");
  });

  it("creates payment_request with telecom, calls proxy, returns pending", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { parent_fee_bps: 275 }, error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "pay-uuid" }, error: null }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));
    mockCallProxy.mockResolvedValue({ payment: { sessionId: "123" } });

    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        telecom: "AM",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(200);
    expect(mockCallProxy).toHaveBeenCalledWith(
      expect.objectContaining({ telecom: "AM", phone: "243812345678" })
    );
  });

  it("returns 409 with SerdiPay duplicate message", async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockStudent, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { parent_fee_bps: 275 }, error: null }),
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

    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const { ProxyError } = await import("../lib/proxy");
    mockCallProxy.mockRejectedValue(
      new ProxyError("A simular transaction is already in process, Please Wait for 2 minutes", 409)
    );

    const res = await POST(
      makeRequest({
        student_id: "STU-001",
        phone: "243812345678",
        telecom: "AM",
        payment_token: "school-token",
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/2 minutes/i);
  });
});
