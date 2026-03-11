import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { GET } from "../app/api/students/[id]/route";
import { NextRequest } from "next/server";
import { supabase } from "../lib/supabase";

const mockFrom = vi.mocked(supabase.from);

describe("GET /api/students/[id]", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 404 if student not found", async () => {
    (mockFrom as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });

    const res = await GET(
      new NextRequest("http://localhost/api/students/UNKNOWN"),
      { params: Promise.resolve({ id: "UNKNOWN" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns student info with school name and amount_due", async () => {
    (mockFrom as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          external_id: "STU-001",
          name: "Jean Kabila",
          amount_due: 15000,
          schools: { name: "École Test" },
        },
        error: null,
      }),
    });

    const res = await GET(
      new NextRequest("http://localhost/api/students/STU-001"),
      { params: Promise.resolve({ id: "STU-001" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      student_id: "STU-001",
      name: "Jean Kabila",
      school_name: "École Test",
      amount_due: 15000,
    });
  });
});
