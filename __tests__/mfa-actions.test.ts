import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSSRClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") },
}));

import {
  beginTotpEnrollment,
  disableTotp,
  verifyMfaChallenge,
  verifyTotpEnrollment,
} from "@/app/actions/mfa";
import { createSSRClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

const FACTOR_ID = "11111111-1111-4111-8111-111111111111";

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("MFA actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts TOTP enrollment and clears stale unverified factors", async () => {
    const unenroll = vi.fn().mockResolvedValue({ error: null });
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: FACTOR_ID,
        totp: { uri: "otpauth://totp/Minerval:test", secret: "SECRET" },
      },
      error: null,
    });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: {
              totp: [],
              all: [{ id: "22222222-2222-4222-8222-222222222222", status: "unverified" }],
            },
            error: null,
          }),
          unenroll,
          enroll,
        },
      },
    } as never);

    const result = await beginTotpEnrollment(null, formData({ locale: "en" }));

    expect(unenroll).toHaveBeenCalledWith({
      factorId: "22222222-2222-4222-8222-222222222222",
    });
    expect(enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Minerval Authenticator",
      issuer: "Minerval",
    });
    expect(result).toEqual({
      factorId: FACTOR_ID,
      qrCode: "data:image/png;base64,qr",
      secret: "SECRET",
    });
  });

  it("verifies only a factor owned by the authenticated user", async () => {
    const challengeAndVerify = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({ data: { all: [{ id: FACTOR_ID }] } }),
          challengeAndVerify,
        },
      },
    } as never);

    const result = await verifyTotpEnrollment(
      null,
      formData({ locale: "fr", factorId: FACTOR_ID, code: "123456" })
    );

    expect(challengeAndVerify).toHaveBeenCalledWith({
      factorId: FACTOR_ID,
      code: "123456",
    });
    expect(result).toEqual({ success: true });
  });

  it("redirects a successful challenge only to an allowed internal path", async () => {
    const challengeAndVerify = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } } }),
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { totp: [{ id: FACTOR_ID, status: "verified" }] },
          }),
          challengeAndVerify,
        },
      },
    } as never);
    vi.mocked(redirect).mockImplementation((path) => {
      throw new Error(`REDIRECT:${path}`);
    });

    await expect(
      verifyMfaChallenge(
        null,
        formData({
          locale: "en",
          factorId: FACTOR_ID,
          code: "123456",
          next: "https://evil.example/steal",
        })
      )
    ).rejects.toThrow("REDIRECT:/en/dashboard");
  });

  it("requires an aal2 session before disabling a verified factor", async () => {
    const unenroll = vi.fn();
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user" } } }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
            data: { currentLevel: "aal1", nextLevel: "aal2" },
          }),
          unenroll,
        },
      },
    } as never);

    const result = await disableTotp(
      null,
      formData({ locale: "en", factorId: FACTOR_ID })
    );

    expect(result).toEqual({ error: "Verify your MFA code first." });
    expect(unenroll).not.toHaveBeenCalled();
  });
});
