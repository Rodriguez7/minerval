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

  it("returns French unauthorized error for viewer role", async () => {
    mockTenant("viewer");
    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBe("Non autorise");
  });

  it("returns French unauthorized error for finance role", async () => {
    mockTenant("finance");
    const result = await changeMemberRole("mem2", "admin");
    expect(result?.error).toBe("Non autorise");
  });

  it("rejects cross-school membership change with French not found error", async () => {
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
    expect(result?.error).toBe("Introuvable");
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

  it("returns French unauthorized error for viewer role", async () => {
    mockTenant("viewer");
    const result = await deactivateMember("mem2");
    expect(result?.error).toBe("Non autorise");
  });

  it("prevents deactivating own membership", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem1", user_id: "uid1", role: "owner", school_id: "school1" });

    const result = await deactivateMember("mem1");
    expect(result?.error).toBeTruthy();
  });

  it("rejects cross-school deactivation with French not found error", async () => {
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
    expect(result?.error).toBe("Introuvable");
  });

  it("allows owner to deactivate another member", async () => {
    mockTenant("owner", "uid1");
    makeAdminWithTarget({ id: "mem2", user_id: "uid2", school_id: "school1" });

    const result = await deactivateMember("mem2");
    expect(result?.error).toBeUndefined();
  });
});

import { sendInvite } from "@/app/dashboard/team/actions";

// The sendInvite action calls from() in this order:
//   1. school_invites.insert().select().single() — always
//   2. school_memberships.upsert()               — only when invite fails (existing user)
function makeAdminWithInvite({
  inviteError = null as null | { message: string },
  existingAuthUser = null as null | { id: string; email: string },
} = {}) {
  const fromMock = vi.fn()
    .mockReturnValueOnce({ // (1) school_invites insert
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { token: "test-token-123" },
            error: null,
          }),
        }),
      }),
    });

  if (inviteError && existingAuthUser) {
    fromMock.mockReturnValueOnce({ // (2) school_memberships upsert (existing-user path)
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
  }

  vi.mocked(getAdminClient).mockReturnValue({
    from: fromMock,
    auth: {
      admin: {
        inviteUserByEmail: vi.fn().mockResolvedValue(
          inviteError
            ? { data: null, error: inviteError }
            : { data: { user: { id: "new-uid" } }, error: null }
        ),
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users: existingAuthUser ? [existingAuthUser] : [],
          },
          error: null,
        }),
      },
    },
  } as never);

  return fromMock;
}

describe("sendInvite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns French unauthorized error for viewer role", async () => {
    mockTenant("viewer");
    const result = await sendInvite("new@school.com", "admin");
    expect(result?.error).toBe("Non autorise");
  });

  it("returns error for invalid role (owner not allowed)", async () => {
    mockTenant("owner");
    // Validation fails before any DB call — no fromMock needed
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const result = await sendInvite("new@school.com", "owner");
    expect(result?.error).toBeTruthy();
  });

  it("sends invite and returns invite link for new user", async () => {
    mockTenant("owner");
    const fromMock = makeAdminWithInvite();
    const result = await sendInvite("new@school.com", "admin");
    expect(result?.error).toBeUndefined();
    expect(result?.inviteLink).toContain("test-token-123");
    expect(fromMock).toHaveBeenCalledTimes(1); // only school_invites insert, no upsert
  });

  it("creates membership directly for existing auth user", async () => {
    mockTenant("admin");
    const fromMock = makeAdminWithInvite({
      inviteError: { message: "A user with this email address has already been registered" },
      existingAuthUser: { id: "existing-uid", email: "existing@school.com" },
    });
    const result = await sendInvite("existing@school.com", "finance");
    expect(result?.error).toBeUndefined();
    expect(fromMock).toHaveBeenCalledTimes(2); // insert + upsert
  });
});
