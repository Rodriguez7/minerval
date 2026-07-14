import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendPayoutCompletedEmail: vi.fn(),
  sendPayoutFailedEmail: vi.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/payouts/[id]/resolve/route";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import { sendPayoutCompletedEmail, sendPayoutFailedEmail } from "@/lib/email";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/payouts/payout-1/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(email: string) {
  vi.mocked(getTenantContext).mockResolvedValue({ user: { email } } as never);
}

function params() {
  return { params: Promise.resolve({ id: "payout-1" }) };
}

describe("manual payout resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SUPER_ADMIN_EMAIL = "admin@minerval.org";
  });

  it("rejects non-super-admin users", async () => {
    context("school@example.com");
    expect((await POST(request({}), params())).status).toBe(403);
  });

  it("requires evidence and a transaction id for completion", async () => {
    context("admin@minerval.org");
    const response = await POST(
      request({ resolution: "completed", note: "Verified in SerdiPay" }),
      params()
    );
    expect(response.status).toBe(400);
  });

  it("returns conflict when the payout is no longer processing", async () => {
    context("admin@minerval.org");
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn(() => query) } as never);

    const response = await POST(
      request({ resolution: "failed", note: "Verified failed in portal" }),
      params()
    );
    expect(response.status).toBe(409);
  });

  it("atomically completes a processing payout and notifies the owner", async () => {
    context("admin@minerval.org");
    const payoutQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "payout-1",
          requested_by: "owner-1",
          net_amount: 9700,
          phone: "243812345678",
          telecom: "AM",
          school_id: "school-1",
        },
        error: null,
      }),
    };
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { email: "owner@example.com" }, error: null }),
    };
    const schoolQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
    };
    const from = vi.fn()
      .mockReturnValueOnce(payoutQuery)
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(schoolQuery);
    vi.mocked(getAdminClient).mockReturnValue({ from } as never);

    const response = await POST(
      request({
        resolution: "completed",
        note: "Verified successful in SerdiPay portal",
        transaction_id: "TX-123",
      }),
      params()
    );

    expect(response.status).toBe(200);
    expect(payoutQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        serdipay_transaction_id: "TX-123",
        failure_reason: expect.stringContaining("admin@minerval.org"),
      })
    );
    expect(sendPayoutCompletedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com", amount: 9700 })
    );
    expect(sendPayoutFailedEmail).not.toHaveBeenCalled();
  });

  it("atomically marks a verified failure and releases the reserved balance", async () => {
    context("admin@minerval.org");
    const payoutQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "payout-1",
          requested_by: "owner-1",
          net_amount: 9700,
          phone: "243812345678",
          telecom: "AM",
          school_id: "school-1",
        },
        error: null,
      }),
    };
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { email: "owner@example.com" }, error: null }),
    };
    const schoolQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { currency: "FC" }, error: null }),
    };
    vi.mocked(getAdminClient).mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(payoutQuery)
        .mockReturnValueOnce(profileQuery)
        .mockReturnValueOnce(schoolQuery),
    } as never);

    const response = await POST(
      request({ resolution: "failed", note: "Operator confirmed no transfer occurred" }),
      params()
    );

    expect(response.status).toBe(200);
    expect(payoutQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
    expect(sendPayoutFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com", amount: 9700 })
    );
    expect(sendPayoutCompletedEmail).not.toHaveBeenCalled();
  });
});
