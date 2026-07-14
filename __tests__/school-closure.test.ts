import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/operations", () => ({ reportOperationalIssue: vi.fn() }));

import { reportOperationalIssue } from "@/lib/operations";
import { closeSchoolSafely } from "@/lib/school-closure";

function queryResult(result: object) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.single = vi.fn(async () => result);
  query.then = vi.fn((resolve: (value: object) => void) => resolve(result));
  return query;
}

function setup({
  pendingPayments = 0,
  pendingPayouts = 0,
  subscriptionId = "sub_123",
  rpcData = { closed: true, already_closed: false },
  rpcError = null,
}: {
  pendingPayments?: number;
  pendingPayouts?: number;
  subscriptionId?: string | null;
  rpcData?: object;
  rpcError?: { message: string } | null;
} = {}) {
  const payments = queryResult({ count: pendingPayments, error: null });
  const payouts = queryResult({ count: pendingPayouts, error: null });
  const subscriptions = queryResult({});
  subscriptions.eq = vi.fn(() => subscriptions);
  subscriptions.single = vi.fn(async () => ({
    data: { stripe_subscription_id: subscriptionId, billing_exempt: false },
    error: null,
  }));

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "payment_requests") return payments;
      if (table === "school_payouts") return payouts;
      return subscriptions;
    }),
  };
  const authenticated = {
    rpc: vi.fn(async () => ({ data: rpcData, error: rpcError })),
  };
  const stripeSubscriptions = {
    retrieve: vi.fn(async () => ({ status: "active" })),
    cancel: vi.fn(async () => ({ status: "canceled" })),
  };

  return { admin, authenticated, stripeSubscriptions };
}

async function close(dependencies: ReturnType<typeof setup>) {
  return closeSchoolSafely({
    schoolId: "school-1",
    reason: "Fin des activites",
    admin: dependencies.admin as never,
    authenticated: dependencies.authenticated as never,
    stripeSubscriptions: dependencies.stripeSubscriptions as never,
  });
}

describe("guarded school closure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks before Stripe when financial activity is pending", async () => {
    const dependencies = setup({ pendingPayments: 2, pendingPayouts: 1 });
    await expect(close(dependencies)).resolves.toEqual({
      ok: false,
      kind: "pending_financial_activity",
      pendingPayments: 2,
      pendingPayouts: 1,
    });
    expect(dependencies.stripeSubscriptions.retrieve).not.toHaveBeenCalled();
    expect(dependencies.authenticated.rpc).not.toHaveBeenCalled();
  });

  it("does not touch the database closure when Stripe cancellation fails", async () => {
    const dependencies = setup();
    dependencies.stripeSubscriptions.cancel.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(close(dependencies)).resolves.toEqual({ ok: false, kind: "stripe_failure" });
    expect(dependencies.authenticated.rpc).not.toHaveBeenCalled();
    expect(reportOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({ source: "school-closure", reference: "school-1" })
    );
  });

  it("cancels an active Stripe subscription before the atomic closure", async () => {
    const dependencies = setup();
    await expect(close(dependencies)).resolves.toEqual({ ok: true, alreadyClosed: false });
    expect(dependencies.stripeSubscriptions.cancel).toHaveBeenCalledWith("sub_123");
    expect(dependencies.authenticated.rpc).toHaveBeenCalledWith("close_school", {
      p_school_id: "school-1",
      p_reason: "Fin des activites",
    });
    expect(
      dependencies.stripeSubscriptions.cancel.mock.invocationCallOrder[0]
    ).toBeLessThan(dependencies.authenticated.rpc.mock.invocationCallOrder[0]);
  });

  it("is retry-safe when Stripe is already canceled", async () => {
    const dependencies = setup({ rpcData: { closed: true, already_closed: true } });
    dependencies.stripeSubscriptions.retrieve.mockResolvedValue({ status: "canceled" });
    await expect(close(dependencies)).resolves.toEqual({ ok: true, alreadyClosed: true });
    expect(dependencies.stripeSubscriptions.cancel).not.toHaveBeenCalled();
    expect(dependencies.authenticated.rpc).toHaveBeenCalledOnce();
  });

  it("raises an operational alert if a race blocks closure after Stripe cancellation", async () => {
    const dependencies = setup({
      rpcData: {
        error: "pending_financial_activity",
        pending_payments: 1,
        pending_payouts: 0,
      },
    });
    await expect(close(dependencies)).resolves.toEqual({
      ok: false,
      kind: "pending_financial_activity",
      pendingPayments: 1,
      pendingPayouts: 0,
    });
    expect(reportOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical", reference: "school-1" })
    );
  });

  it("reports an incomplete database closure after Stripe was canceled", async () => {
    const dependencies = setup({ rpcError: { message: "database unavailable" } });
    await expect(close(dependencies)).resolves.toEqual({ ok: false, kind: "database_failure" });
    expect(reportOperationalIssue).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical", reference: "school-1" })
    );
  });
});
