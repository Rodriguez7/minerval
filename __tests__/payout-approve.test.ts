import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("../lib/proxy", () => ({
  callProxyPayout: vi.fn(),
  ProxyError: class ProxyError extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.status = status; }
  },
}));
vi.mock("../lib/email", () => ({
  sendPayoutFailedEmail: vi.fn(),
}));
vi.mock("../lib/tenant", () => ({ getTenantContext: vi.fn() }));

import { POST } from "../app/api/admin/payouts/[id]/approve/route";
import { NextRequest } from "next/server";
import { getAdminClient } from "../lib/supabase";
import { callProxyPayout, ProxyError } from "../lib/proxy";
import { sendPayoutFailedEmail } from "../lib/email";
import { getTenantContext } from "../lib/tenant";

type AdminClient = ReturnType<typeof getAdminClient>;

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/payouts/${id}/approve`, {
    method: "POST",
  });
}

function asAdminClient(client: { from: unknown }) {
  return client as unknown as AdminClient;
}

const mockPayout = {
  id: "payout-uuid",
  school_id: "school-uuid",
  requested_by: "user-uuid",
  amount: 5000,
  fee_bps: 300,
  fee_amount: 150,
  net_amount: 4850,
  phone: "0812345678",
  telecom: "OM",
  status: "pending",
};

describe("POST /api/admin/payouts/[id]/approve", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://www.minerval.org";
    process.env.SERDIPAY_CALLBACK_SECRET = "test-callback-secret";
    process.env.SUPER_ADMIN_EMAIL = "admin@test.com";
  });

  it("returns 403 if user is not super admin", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "notadmin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 if payout is not pending (re-entrancy guard)", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(409);
  });

  it("calls proxy and returns 200 on success", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn().mockReturnValueOnce({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));
    vi.mocked(callProxyPayout).mockResolvedValueOnce({});

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(200);
    expect(callProxyPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4850,
        phone: "0812345678",
        telecom: "OM",
        callback_url:
          "https://www.minerval.org/api/serdipay/payout-callback?secret=test-callback-secret",
      })
    );
  });

  it("marks failed and sends email when proxy throws", async () => {
    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { email: "owner@test.com" }, error: null }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));
    const PE = ProxyError as unknown as new (msg: string, status: number) => InstanceType<typeof ProxyError>;
    vi.mocked(callProxyPayout).mockRejectedValueOnce(new PE("SerdiPay error", 502));

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(502);
    expect(sendPayoutFailedEmail).toHaveBeenCalled();
  });

  it("returns 503 when payout callback secret is missing", async () => {
    delete process.env.SERDIPAY_CALLBACK_SECRET;

    vi.mocked(getTenantContext).mockResolvedValueOnce({
      user: { id: "user-uuid", email: "admin@test.com" },
      school: { id: "school-uuid", currency: "FC" },
      membership: { role: "owner" },
    } as never);

    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPayout, error: null }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue(asAdminClient({ from: mockFrom }));

    const res = await POST(makeRequest("payout-uuid"), { params: Promise.resolve({ id: "payout-uuid" }) });
    expect(res.status).toBe(503);
    expect(callProxyPayout).not.toHaveBeenCalled();
  });
});
