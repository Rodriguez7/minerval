import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { changeMemberRole, deactivateMember } from "@/app/dashboard/team/actions";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import type { TenantContext } from "@/lib/types";

function mockTenant(role: "owner" | "admin" | "finance" | "viewer", userId = "uid1") {
  vi.mocked(getTenantContext).mockResolvedValue({
    user: { id: userId, email: "admin@school.com" },
    school: { id: "school1" } as TenantContext["school"],
    membership: { id: "mem1", role, status: "active" },
    plan: {} as TenantContext["plan"],
    subscription: {} as TenantContext["subscription"],
  });
}

function makeAdminWithTarget(target: Record<string, unknown>) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const fromMock = vi.fn()
    .mockReturnValueOnce({  // first call: select target membership
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: target, error: null }),
    })
    .mockReturnValueOnce({  // second call: update
      update: vi.fn().mockReturnValue(updateChain),
    });
  vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);
  return fromMock;
}

describe("changeMemberRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns Unauthorized for viewer role", async () => {
    mockTenant("viewer");
    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBe("Unauthorized");
  });

  it("returns Unauthorized for finance role", async () => {
    mockTenant("finance");
    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBe("Unauthorized");
  });

  it("rejects cross-school membership change", async () => {
    mockTenant("owner", "uid1");
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "mem2", user_id: "uid2", role: "viewer", school_id: "other-school" },
        error: null,
      }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBe("Not found");
  });

  it("allows owner to change another member's role", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem2", user_id: "uid2", role: "viewer", school_id: "school1" });

    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBeUndefined();
  });

  it("prevents changing own role", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem2", user_id: "uid1", role: "owner", school_id: "school1" });

    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBeTruthy();
  });
});

describe("deactivateMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns Unauthorized for viewer role", async () => {
    mockTenant("viewer");
    const result = await deactivateMember("mem2");
    expect(result?.error).toBe("Unauthorized");
  });

  it("prevents deactivating own membership", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem1", user_id: "uid1", role: "owner", school_id: "school1" });

    const result = await deactivateMember("mem1");
    expect(result?.error).toBeTruthy();
  });

  it("rejects cross-school deactivation", async () => {
    mockTenant("owner", "uid1");
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "mem2", user_id: "uid2", school_id: "other-school" },
        error: null,
      }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const result = await deactivateMember("mem2");
    expect(result?.error).toBe("Not found");
  });

  it("allows owner to deactivate another member", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem2", user_id: "uid2", school_id: "school1" });

    const result = await deactivateMember("mem2");
    expect(result?.error).toBeUndefined();
  });
});
