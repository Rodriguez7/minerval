import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("../lib/supabase", () => ({
  createSSRClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const mockInsertSelect = vi.fn().mockResolvedValue({
  data: [{ id: "1" }, { id: "2" }],
  error: null,
});
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockStudentFrom = vi.fn(() => ({ insert: mockInsert }));

const mockMembershipSingle = vi.fn().mockResolvedValue({
  data: { school_id: "school-id" },
  error: null,
});
const mockMembershipEq = vi.fn(() => ({ single: mockMembershipSingle }));
const mockMembershipSelect = vi.fn(() => ({ eq: mockMembershipEq }));
const mockMembershipFrom = vi.fn(() => ({ select: mockMembershipSelect }));

const mockRpcSingle = vi.fn().mockResolvedValue({
  data: { prefix: "STU", new_seq: 2 },
  error: null,
});
const mockRpc = vi.fn(() => ({ single: mockRpcSingle }));

import { createSSRClient } from "../lib/supabase";

type SSRClient = Awaited<ReturnType<typeof createSSRClient>>;

function asSSRClient(client: { auth: unknown; from: unknown; rpc: unknown }) {
  return client as unknown as SSRClient;
}

describe("POST /api/dashboard/students/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSSRClient).mockResolvedValue(asSSRClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: "admin@test.com" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "school_memberships") return mockMembershipFrom();
        return mockStudentFrom();
      }),
      rpc: mockRpc,
    }));
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
          rows: [{ external_id: "", full_name: "Bad", amount_due: -1 }],
        }),
      }
    );
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });
});
