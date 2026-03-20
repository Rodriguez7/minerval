import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";

const fromMock = vi.fn();
const rpcMock = vi.fn();
const adminMock = { from: fromMock, rpc: rpcMock };

const PRO_CONTEXT = {
  school: { id: "school-id", code: "STU", currency: "FC" },
  membership: { role: "admin" },
  plan: { can_bulk_ops: true, max_students: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminClient).mockReturnValue(adminMock as never);
  vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);
});

describe("POST /api/dashboard/students/import", () => {
  it("imports valid rows and returns count", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { prefix: "STU", new_seq: 2 },
      error: null,
    });

    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "1" }, { id: "2" }],
        error: null,
      }),
    });

    const { POST } = await import(
      "../app/api/dashboard/students/import/route"
    );
    const req = new Request(
      "http://localhost/api/dashboard/students/import",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: [
            { full_name: "Alice", amount_due: 5000 },
            { full_name: "Bob", class_name: "CP1", amount_due: 3000 },
          ],
        }),
      }
    );
    const res = await POST(req as unknown as NextRequest);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.imported).toBe(2);
  });

  it("returns 400 for invalid rows", async () => {
    const { POST } = await import(
      "../app/api/dashboard/students/import/route"
    );
    const req = new Request(
      "http://localhost/api/dashboard/students/import",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: [{ full_name: "Bad", amount_due: -1 }],
        }),
      }
    );
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});
