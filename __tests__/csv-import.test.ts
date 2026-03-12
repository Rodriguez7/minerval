import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  getAdminClient: vi.fn(),
  createSSRClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockUpsertSelect = vi.fn().mockResolvedValue({
  data: [{ id: "1" }, { id: "2" }],
  error: null,
});
const mockUpsert = vi.fn(() => ({ select: mockUpsertSelect }));
const mockStudentFrom = vi.fn(() => ({ upsert: mockUpsert }));

const mockSchoolSingle = vi.fn().mockResolvedValue({
  data: { id: "school-id", admin_email: "admin@test.com" },
  error: null,
});
const mockSchoolEq = vi.fn(() => ({ single: mockSchoolSingle }));
const mockSchoolSelect = vi.fn(() => ({ eq: mockSchoolEq }));
const mockSchoolFrom = vi.fn(() => ({ select: mockSchoolSelect }));

import { getAdminClient, createSSRClient } from "../lib/supabase";

describe("POST /api/dashboard/students/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createSSRClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@test.com" } },
        }),
      },
    });
    (getAdminClient as any).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "schools") return mockSchoolFrom();
        return mockStudentFrom();
      }),
    });
  });

  it("imports valid rows and returns count", async () => {
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
            { external_id: "S1", full_name: "Alice", amount_due: 5000 },
            {
              external_id: "S2",
              full_name: "Bob",
              class_name: "CP1",
              amount_due: 3000,
            },
          ],
        }),
      }
    );
    const res = await POST(req as any);
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
          rows: [{ external_id: "", full_name: "Bad", amount_due: -1 }],
        }),
      }
    );
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});
