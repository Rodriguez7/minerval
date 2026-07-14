import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getAdminClient: vi.fn(() => ({})),
  createSSRClient: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/school-closure", () => ({ closeSchoolSafely: vi.fn() }));

import { POST } from "@/app/api/dashboard/account/close/route";
import { consumeRateLimit } from "@/lib/rate-limit";
import { closeSchoolSafely } from "@/lib/school-closure";
import { createSSRClient } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { getStripe } from "@/lib/stripe";

const context = {
  user: { id: "user-1" },
  school: { id: "school-1", code: "ECOLE-01" },
  membership: { role: "owner" },
};
const signOut = vi.fn();

function request(body: object) {
  return new Request("http://localhost/api/dashboard/account/close", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("school closure endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantContext).mockResolvedValue(context as never);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    vi.mocked(createSSRClient).mockResolvedValue({ auth: { signOut } } as never);
    vi.mocked(getStripe).mockReturnValue({ subscriptions: {} } as never);
  });

  it("allows only the owner", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...context,
      membership: { role: "admin" },
    } as never);
    const response = await POST(request({ confirmation: "ECOLE-01" }));
    expect(response.status).toBe(403);
    expect(closeSchoolSafely).not.toHaveBeenCalled();
  });

  it("requires the exact school code", async () => {
    const response = await POST(request({ confirmation: "ecole-01" }));
    expect(response.status).toBe(400);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(closeSchoolSafely).not.toHaveBeenCalled();
  });

  it("returns pending counts without signing out", async () => {
    vi.mocked(closeSchoolSafely).mockResolvedValue({
      ok: false,
      kind: "pending_financial_activity",
      pendingPayments: 2,
      pendingPayouts: 1,
    });
    const response = await POST(request({ confirmation: "ECOLE-01" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ pending_payments: 2, pending_payouts: 1 });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs the owner out only after successful closure", async () => {
    vi.mocked(closeSchoolSafely).mockResolvedValue({ ok: true, alreadyClosed: false });
    const response = await POST(
      request({ confirmation: "ECOLE-01", reason: "Fin des activites" })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ closed: true, already_closed: false });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
