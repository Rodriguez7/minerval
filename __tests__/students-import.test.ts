import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dashboard/students/import/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const fromMock = vi.fn();
const adminMock = { from: fromMock, rpc: vi.fn() };

function makeRequest(rows: unknown[]) {
  return new NextRequest("http://localhost/api/dashboard/students/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}

const VALID_ROW = { full_name: "Alice", amount_due: 1000 };

const PRO_CONTEXT = {
  school: { id: "school1", code: "TST", currency: "FC" },
  membership: { role: "admin" },
  plan: { can_bulk_ops: true, max_students: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminClient).mockReturnValue(adminMock as never);
});

describe("POST /api/dashboard/students/import", () => {
  it("returns 403 when can_bulk_ops is false", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...PRO_CONTEXT,
      plan: { can_bulk_ops: false, max_students: null },
    } as never);

    const res = await POST(makeRequest([VALID_ROW]));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/pro plan/i);
  });

  it("returns 400 when max_students cap is exceeded on bulk import", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...PRO_CONTEXT,
      plan: { can_bulk_ops: true, max_students: 5 },
    } as never);

    // Mock: school already has 4 students
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
      }),
    });

    // Trying to import 2 rows → 4 + 2 = 6 > 5
    const res = await POST(makeRequest([VALID_ROW, VALID_ROW]));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/student limit/i);
  });

  it("proceeds when max_students is null (unlimited)", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);

    // Mock RPC
    adminMock.rpc.mockResolvedValueOnce({
      data: { prefix: "TST", new_seq: 1 },
      error: null,
    });

    // Mock insert
    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: "s1" }], error: null }),
    });

    const res = await POST(makeRequest([VALID_ROW]));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
  });
});
