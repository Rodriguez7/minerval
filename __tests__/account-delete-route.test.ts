import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSSRClient: vi.fn(), getAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("@/lib/user-account-deletion", () => ({ deletePersonalAccount: vi.fn() }));

import { POST } from "@/app/api/account/delete/route";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSSRClient } from "@/lib/supabase";
import { deletePersonalAccount } from "@/lib/user-account-deletion";

const getUser = vi.fn();

function request(body: object) {
  return new Request("http://localhost/api/account/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("personal account deletion endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "me@example.com" } } });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { getUser } } as never);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(request({ confirmation: "me@example.com", password: "secret1" }));
    expect(response.status).toBe(401);
    expect(deletePersonalAccount).not.toHaveBeenCalled();
  });

  it("requires exact email confirmation before consuming a rate-limit attempt", async () => {
    const response = await POST(request({ confirmation: "ME@example.com", password: "secret1" }));
    expect(response.status).toBe(400);
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("rate limits password attempts", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
    });
    const response = await POST(request({ confirmation: "me@example.com", password: "secret1" }));
    expect(response.status).toBe(429);
    expect(deletePersonalAccount).not.toHaveBeenCalled();
  });

  it("returns the active schools that block owner deletion", async () => {
    vi.mocked(deletePersonalAccount).mockResolvedValue({
      ok: false,
      kind: "active_owner",
      schools: ["Ecole Test"],
    });
    const response = await POST(request({ confirmation: "me@example.com", password: "secret1" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ schools: ["Ecole Test"] });
  });

  it("returns success only after the deletion service succeeds", async () => {
    vi.mocked(deletePersonalAccount).mockResolvedValue({ ok: true });
    const response = await POST(request({ confirmation: "me@example.com", password: "secret1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
  });
});
