import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({ createSSRClient: vi.fn() }));

import { GET } from "@/app/auth/callback/route";
import { createSSRClient } from "@/lib/supabase";

describe("GET /auth/callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exchanges the PKCE code and redirects to safe onboarding", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as never);
    const request = new NextRequest(
      "https://0.0.0.0:8080/fr/auth/callback?code=auth-code&next=%2Ffr%2Fonboarding%2Fschool"
    );

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/fr/onboarding/school"
    );
  });

  it("rejects external redirect destinations", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as never);
    const request = new NextRequest(
      "https://www.minerval.org/en/auth/callback?code=auth-code&next=https%3A%2F%2Fevil.example%2Fsteal"
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/en/dashboard"
    );
  });

  it("returns OAuth failures to the localized login page", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "invalid code" },
    });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as never);
    const request = new NextRequest(
      "https://www.minerval.org/en/auth/callback?code=bad"
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/en/login?error=oauth"
    );
  });
});
