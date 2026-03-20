import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  createSSRClient: vi.fn(),
  getAdminClient: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addStudent } from "@/app/dashboard/students/actions";
import { getTenantContext } from "@/lib/tenant";
import { createSSRClient } from "@/lib/supabase";

const fromMock = vi.fn();
const ssrMock = { from: fromMock, rpc: vi.fn() };

function makeFormData(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

const VALID_FORM = { full_name: "Alice", amount_due: "1000" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSSRClient).mockResolvedValue(ssrMock as never);
});

describe("addStudent", () => {
  it("returns error when max_students cap is reached", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      school: { id: "school1", code: "TST" },
      membership: { role: "admin" },
      plan: { max_students: 10 },
    } as never);

    // Mock: school already has 10 students
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValue({ data: { count: 10 }, error: null }),
        }),
      }),
    });

    const result = await addStudent(null, makeFormData(VALID_FORM));

    expect(result).toEqual({ error: expect.stringMatching(/student limit/i) });
  });

  it("proceeds when max_students is null (unlimited)", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      school: { id: "school1", code: "TST" },
      membership: { role: "admin" },
      plan: { max_students: null },
    } as never);

    ssrMock.rpc.mockResolvedValueOnce({
      data: { prefix: "TST", new_seq: 1 },
      error: null,
    });

    fromMock.mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await addStudent(null, makeFormData(VALID_FORM));

    // Should not return a student limit error
    if (result?.error) {
      expect(result.error).not.toMatch(/student limit/i);
    }
  });
});
