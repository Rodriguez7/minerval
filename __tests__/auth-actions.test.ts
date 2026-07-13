import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  createSSRClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { login, resetPassword } from "@/app/actions/auth";
import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

function makeFormData(data: Record<string, string>) {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("auth actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invalid credentials when sign-in fails", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" },
        }),
      },
    } as never);

    const result = await login(
      null,
      makeFormData({ email: "admin@school.com", password: "password123", locale: "fr" })
    );

    expect(result).toEqual({ error: "Email ou mot de passe invalide." });
  });

  it("returns a controlled error when sign-in throws", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      },
    } as never);

    const result = await login(
      null,
      makeFormData({ email: "admin@school.com", password: "password123", locale: "fr" })
    );

    expect(result).toEqual({
      error: "Le service d'authentification est temporairement indisponible. Reessayez.",
    });
  });

  it("redirects to the localized dashboard on successful sign-in", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      },
    } as never);
    vi.mocked(redirect).mockImplementation((path) => {
      throw new Error(`REDIRECT:${path}`);
    });

    await expect(
      login(
        null,
        makeFormData({ email: "admin@school.com", password: "password123", locale: "en" })
      )
    ).rejects.toThrow("REDIRECT:/en/dashboard");
  });

  it("returns a controlled error when reset password throws", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        resetPasswordForEmail: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      },
    } as never);

    const result = await resetPassword(
      null,
      makeFormData({ email: "admin@school.com", locale: "en" })
    );

    expect(result).toEqual({
      error: "The authentication service is temporarily unavailable. Please try again.",
    });
  });
});
