import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn(), createSSRClient: vi.fn() }));

import { getTenantContext } from "@/lib/tenant";
import { createSSRClient, getAdminClient } from "@/lib/supabase";

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
  vi.mocked(createSSRClient).mockResolvedValue(adminMock as never);
  vi.mocked(getTenantContext).mockResolvedValue(PRO_CONTEXT as never);
});

describe("POST /api/dashboard/students/import", () => {
  it("imports valid rows and returns count", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { imported: 2 },
      error: null,
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
            { full_name: "Alice", amount_due: 5000, balance_due_at: "2026-09-15", guardian_name: "Chantal", guardian_whatsapp: "0812345678", guardian_relationship: "parent", whatsapp_consent: true },
            { full_name: "Bob", class_name: "CP1", amount_due: 3000, balance_due_at: "2026-09-15", guardian_name: "Paul", guardian_whatsapp: "0991234567", guardian_relationship: "guardian", whatsapp_consent: true },
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
          rows: [{ full_name: "Bad", amount_due: -1, balance_due_at: "2026-09-15", guardian_name: "Bad", guardian_whatsapp: "0812345678", guardian_relationship: "parent", whatsapp_consent: true }],
        }),
      }
    );
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});
