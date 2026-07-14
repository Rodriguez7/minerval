import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/operations", () => ({ reportOperationalIssue: vi.fn() }));

import { reportOperationalIssue } from "@/lib/operations";
import { deletePersonalAccount } from "@/lib/user-account-deletion";

function query(result: object) {
  const value: Record<string, ReturnType<typeof vi.fn>> = {};
  value.select = vi.fn(() => value);
  value.eq = vi.fn(() => value);
  value.in = vi.fn(() => value);
  value.update = vi.fn(() => value);
  value.delete = vi.fn(() => value);
  value.then = vi.fn((resolve: (result: object) => void) => resolve(result));
  return value;
}

function setup({
  ownerships = [],
  schools = [],
  passwordError = null,
  deletionError = null,
  cleanupError = null,
}: {
  ownerships?: { school_id: string }[];
  schools?: { id: string; name: string }[];
  passwordError?: { message: string } | null;
  deletionError?: { message: string } | null;
  cleanupError?: { message: string } | null;
} = {}) {
  const ownershipQuery = query({ data: ownerships, error: null });
  const schoolQuery = query({ data: schools, error: null });
  const cleanupQueries = [
    query({ error: cleanupError }),
    query({ error: null }),
    query({ error: null }),
  ];
  let schoolCall = 0;
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "school_memberships") return ownershipQuery;
      if (table === "schools" && ownerships.length > 0 && schoolCall++ === 0) {
        return schoolQuery;
      }
      return cleanupQueries.shift() ?? query({ error: null });
    }),
    auth: { admin: { deleteUser: vi.fn(async () => ({ error: deletionError })) } },
  };
  const authenticated = {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: passwordError })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
  return { admin, authenticated };
}

async function remove(dependencies: ReturnType<typeof setup>) {
  return deletePersonalAccount({
    userId: "user-12345678",
    email: "owner@example.com",
    password: "secret-password",
    admin: dependencies.admin as never,
    authenticated: dependencies.authenticated as never,
  });
}

describe("personal account deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks an owner of an active school before password or identity changes", async () => {
    const dependencies = setup({
      ownerships: [{ school_id: "school-1" }],
      schools: [{ id: "school-1", name: "Ecole Test" }],
    });
    await expect(remove(dependencies)).resolves.toEqual({
      ok: false,
      kind: "active_owner",
      schools: ["Ecole Test"],
    });
    expect(dependencies.authenticated.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(dependencies.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("requires the current password", async () => {
    const dependencies = setup({ passwordError: { message: "invalid login" } });
    await expect(remove(dependencies)).resolves.toEqual({
      ok: false,
      kind: "invalid_password",
    });
    expect(dependencies.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("allows a former owner to delete after the school is closed", async () => {
    const dependencies = setup({
      ownerships: [{ school_id: "school-closed" }],
      schools: [],
    });
    await expect(remove(dependencies)).resolves.toEqual({ ok: true });
    expect(dependencies.admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
  });

  it("deletes the identity, cleans direct email data, and signs out", async () => {
    const dependencies = setup();
    await expect(remove(dependencies)).resolves.toEqual({ ok: true });
    expect(dependencies.admin.auth.admin.deleteUser).toHaveBeenCalledWith("user-12345678");
    expect(dependencies.admin.from).toHaveBeenCalledWith("school_invites");
    expect(dependencies.admin.from).toHaveBeenCalledWith("schools");
    expect(dependencies.authenticated.auth.signOut).toHaveBeenCalledOnce();
  });

  it("does not report success if Supabase identity deletion fails", async () => {
    const dependencies = setup({ deletionError: { message: "delete failed" } });
    await expect(remove(dependencies)).resolves.toEqual({ ok: false, kind: "auth_failure" });
    expect(dependencies.authenticated.auth.signOut).not.toHaveBeenCalled();
    expect(reportOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({ source: "user-account-deletion", reference: "user-12345678" })
    );
  });

  it("finishes identity deletion but alerts when email cleanup is incomplete", async () => {
    const dependencies = setup({ cleanupError: { message: "cleanup failed" } });
    await expect(remove(dependencies)).resolves.toEqual({ ok: true });
    expect(reportOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "warning", reference: "user-12345678" })
    );
    expect(dependencies.authenticated.auth.signOut).toHaveBeenCalledOnce();
  });
});
