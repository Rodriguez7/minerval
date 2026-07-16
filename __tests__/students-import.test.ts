import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dashboard/students/import/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn(), createSSRClient: vi.fn() }));

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

const fromMock = vi.fn();
const adminMock = { from: fromMock, rpc: vi.fn() };

function makeRequest(rows: unknown[]) {
  return new NextRequest("http://localhost/api/dashboard/students/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}

const VALID_ROW = {
  full_name: "Alice",
  amount_due: 1000,
  balance_due_at: "2026-09-15",
  guardian_name: "Chantal",
  guardian_whatsapp: "0812345678",
  guardian_relationship: "parent",
  whatsapp_consent: true,
};

const PRO_CONTEXT = {
  school: { id: "school1", code: "TST", currency: "FC" },
  membership: { role: "admin" },
  plan: { can_bulk_ops: true, max_students: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminClient).mockReturnValue(adminMock as never);
  vi.mocked(createSSRClient).mockResolvedValue(adminMock as never);
});

describe("POST /api/dashboard/students/import", () => {
  it("returns French 403 when can_bulk_ops is false", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...PRO_CONTEXT,
      plan: { can_bulk_ops: false, max_students: null },
    } as never);

    const res = await POST(makeRequest([VALID_ROW]));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("L'import CSV exige un plan Pro.");
  });

  it("returns French 400 when max_students cap is exceeded on bulk import", async () => {
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
    expect(body.error).toBe(
      "Limite d'eleves atteinte. Votre plan autorise 5 eleves (actuellement 4)."
    );
  });

  it("proceeds when max_students is null (unlimited)", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);

    adminMock.rpc.mockResolvedValueOnce({
      data: { imported: 1 },
      error: null,
    });

    const res = await POST(makeRequest([VALID_ROW]));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imported).toBe(1);
  });
});
