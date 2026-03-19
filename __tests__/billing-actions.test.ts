import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: { create: vi.fn() },
    },
    billingPortal: {
      sessions: { create: vi.fn() },
    },
  },
  PLAN_PRICE_IDS: {
    growth_monthly: "price_growth",
    pro_monthly: "price_pro",
  },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createCheckoutSession, createPortalSession } from "@/app/actions/billing";
import { getTenantContext } from "@/lib/tenant";
import { stripe } from "@/lib/stripe";
import { redirect } from "next/navigation";
import type { TenantContext } from "@/lib/types";

function mockTenant(overrides: Partial<TenantContext> = {}) {
  vi.mocked(getTenantContext).mockResolvedValue({
    user: { id: "uid1", email: "admin@school.com" },
    school: { id: "school1", billing_email: "billing@school.com" } as TenantContext["school"],
    membership: { id: "mem1", role: "owner", status: "active" },
    plan: { code: "starter_free", monthly_price_usd: 0 } as TenantContext["plan"],
    subscription: {
      plan_code: "starter_free",
      status: "active",
      trial_ends_at: null,
      current_period_end: null,
      billing_exempt: false,
      stripe_customer_id: null,
    },
    ...overrides,
  });
}

describe("createCheckoutSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error for invalid plan code", async () => {
    mockTenant();
    const result = await createCheckoutSession("invalid_plan");
    expect(result?.error).toBeTruthy();
  });

  it("returns Unauthorized for non-owner/admin role", async () => {
    mockTenant({ membership: { id: "mem1", role: "viewer", status: "active" } });
    const result = await createCheckoutSession("growth_monthly");
    expect(result?.error).toBe("Unauthorized");
  });

  it("returns error for starter_free plan", async () => {
    mockTenant();
    const result = await createCheckoutSession("starter_free");
    expect(result?.error).toBeTruthy();
  });

  it("returns error when session.url is missing", async () => {
    mockTenant();
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: null,
    } as never);

    const result = await createCheckoutSession("growth_monthly");
    expect(result?.error).toBeTruthy();
  });

  it("creates Stripe Checkout session for growth_monthly and redirects", async () => {
    mockTenant();
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_123",
    } as never);
    vi.mocked(redirect).mockImplementation((url) => {
      throw new Error(`REDIRECT:${url}`);
    });

    await expect(createCheckoutSession("growth_monthly")).rejects.toThrow(
      "REDIRECT:https://checkout.stripe.com/pay/cs_123"
    );

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_growth", quantity: 1 }],
        metadata: { school_id: "school1" },
        subscription_data: expect.objectContaining({
          trial_period_days: 14,
          metadata: { school_id: "school1" },
        }),
      })
    );
  });
});

describe("createPortalSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns Unauthorized for non-owner/admin role", async () => {
    mockTenant({ membership: { id: "mem1", role: "viewer", status: "active" } });
    const result = await createPortalSession();
    expect(result?.error).toBe("Unauthorized");
  });

  it("returns error if no stripe_customer_id", async () => {
    mockTenant({
      subscription: {
        plan_code: "starter_free",
        status: "active",
        trial_ends_at: null,
        current_period_end: null,
        billing_exempt: false,
        stripe_customer_id: null,
      },
    });
    const result = await createPortalSession();
    expect(result?.error).toBeTruthy();
  });

  it("creates portal session and redirects", async () => {
    mockTenant({
      subscription: {
        plan_code: "growth_monthly",
        status: "active",
        trial_ends_at: null,
        current_period_end: null,
        billing_exempt: false,
        stripe_customer_id: "cus_123",
      },
    });
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: "https://billing.stripe.com/session/bps_123",
    } as never);
    vi.mocked(redirect).mockImplementation((url) => {
      throw new Error(`REDIRECT:${url}`);
    });

    await expect(createPortalSession()).rejects.toThrow(
      "REDIRECT:https://billing.stripe.com/session/bps_123"
    );

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        return_url: expect.stringContaining("/dashboard/billing"),
      })
    );
  });
});
