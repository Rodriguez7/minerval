import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  getAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("../lib/payment-access", () => ({
  getSchoolByPaymentAccessToken: vi.fn(),
}));

import { GET } from "../app/api/students/[id]/route";
import { NextRequest } from "next/server";
import { getSchoolByPaymentAccessToken } from "../lib/payment-access";
import { getAdminClient } from "../lib/supabase";

type AdminClient = ReturnType<typeof getAdminClient>;

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

function makeAllowedRateLimitQueries() {
  return [
    {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 0 }),
    },
    {
      insert: vi.fn().mockResolvedValue({ error: null }),
    },
    {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ error: null }),
    },
  ];
}

describe("GET /api/students/[id]", () => {
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

  it("returns 400 when payment_token is missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/students/STU-001"),
      { params: Promise.resolve({ id: "STU-001" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 if student not found", async () => {
    const [rateCount, rateInsert, ratePrune] = makeAllowedRateLimitQueries();
    const mockFrom = vi.fn()
      .mockReturnValueOnce(rateCount)
      .mockReturnValueOnce(rateInsert)
      .mockReturnValueOnce(ratePrune)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await GET(
      new NextRequest("http://localhost/api/students/UNKNOWN?payment_token=school-token"),
      { params: Promise.resolve({ id: "UNKNOWN" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns student info with school name and amount_due", async () => {
    const [rateCount, rateInsert, ratePrune] = makeAllowedRateLimitQueries();
    const mockFrom = vi.fn()
      .mockReturnValueOnce(rateCount)
      .mockReturnValueOnce(rateInsert)
      .mockReturnValueOnce(ratePrune)
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
        data: {
          external_id: "STU-001",
          full_name: "Jean Kabila",
          amount_due: 15000,
        },
        error: null,
      }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await GET(
      new NextRequest("http://localhost/api/students/STU-001?payment_token=school-token"),
      { params: Promise.resolve({ id: "STU-001" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      student_id: "STU-001",
      full_name: "Jean Kabila",
      school_name: "École Test",
      school_code: "ecole-test",
      amount_due: 15000,
    });
  });
});

