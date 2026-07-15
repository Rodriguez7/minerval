import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be set before any import that uses them
vi.mock("@/lib/supabase", () => ({
  createSSRClient: vi.fn(),
  getAdminClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { signup } from "@/app/actions/auth";
import { createSSRClient, getAdminClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

function makeFormData(data: Record<string, string>) {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("signup action (Phase 1b)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid email", async () => {
    const result = await signup(null, makeFormData({ email: "bad", password: "password123" }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects short password", async () => {
    const result = await signup(null, makeFormData({ email: "a@b.com", password: "short" }));
    expect(result?.error).toBeTruthy();
  });

  it("rejects signup without explicit legal acceptance", async () => {
    const result = await signup(
      null,
      makeFormData({ email: "a@b.com", password: "password123" })
    );
    expect(result?.error).toBeTruthy();
    expect(createSSRClient).not.toHaveBeenCalled();
  });

  it("returns auth error when signUp fails", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "Email already registered" } }) },
    } as never);
    const result = await signup(null, makeFormData({ email: "a@b.com", password: "password123", legalAccepted: "yes" }));
    expect(result?.error).toBe("Email already registered");
  });

  it("does NOT create school or membership on success", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "uid1" }, session: { access_token: "token" } }, error: null });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { signUp },
    } as never);
    vi.mocked(redirect).mockImplementation(() => { throw new Error("REDIRECT"); });

    await expect(signup(null, makeFormData({ email: "a@b.com", password: "password123", legalAccepted: "yes" }))).rejects.toThrow("REDIRECT");

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: {
        emailRedirectTo: "https://www.minerval.org/fr/onboarding/school",
        data: {
          legal_version: "2026-07-14",
          legal_accepted_at: expect.any(String),
          locale: "fr",
        },
      },
    }));

    // getAdminClient should never be called — no school creation
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it("redirects to the French onboarding path on success", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { signUp: vi.fn().mockResolvedValue({ data: { user: { id: "uid1" }, session: { access_token: "token" } }, error: null }) },
    } as never);
    vi.mocked(redirect).mockImplementation((path) => { throw new Error(`REDIRECT:${path}`); });

    await expect(signup(null, makeFormData({ email: "a@b.com", password: "password123", legalAccepted: "yes" }))).rejects.toThrow("REDIRECT:/fr/onboarding/school");
  });

  it("returns a check-email state when confirmation is required", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "uid1" }, session: null },
      error: null,
    });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { signUp } } as never);

    const result = await signup(
      null,
      makeFormData({
        email: "a@b.com",
        password: "password123",
        legalAccepted: "yes",
        locale: "en",
      })
    );

    expect(result).toEqual({ success: true });
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://www.minerval.org/en/onboarding/school",
        }),
      })
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
