import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({ createSSRClient: vi.fn() }));

import { GET } from "@/app/auth/confirm/route";
import { createSSRClient } from "@/lib/supabase";

describe("GET /auth/confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the token and redirects to localized onboarding", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { verifyOtp } } as never);
    const request = new NextRequest(
      "https://www.minerval.org/auth/confirm?token_hash=secret&type=email&next=https%3A%2F%2Fwww.minerval.org%2Fen%2Fonboarding%2Fschool"
    );

    const response = await GET(request);

    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "secret" });
    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/en/onboarding/school"
    );
  });

  it("rejects an external next URL", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { verifyOtp } } as never);
    const request = new NextRequest(
      "https://www.minerval.org/auth/confirm?token_hash=secret&type=email&next=https%3A%2F%2Fevil.example%2Fsteal"
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/fr/onboarding/school"
    );
  });

  it("redirects invalid confirmations to a clean login URL", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: { message: "expired" } });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { verifyOtp } } as never);
    const request = new NextRequest(
      "https://www.minerval.org/auth/confirm?token_hash=expired&type=email&next=https%3A%2F%2Fwww.minerval.org%2Fen%2Fonboarding%2Fschool"
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/en/login?error=confirmation"
    );
  });
});
