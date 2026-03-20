import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe before any imports that use it
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
  priceIdToPlanCode: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getAdminClient: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/stripe/route";
import { stripe, priceIdToPlanCode } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function makeRequest(body: string, signature = "valid-sig") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
    body,
  });
}

const CHECKOUT_COMPLETED_EVENT = {
  id: "evt_checkout_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      customer: "cus_123",
      subscription: "sub_123",
      metadata: { school_id: "school1" },
    },
  },
};

const SUBSCRIPTION_UPDATED_EVENT = {
  id: "evt_sub_1",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_end: 1800000000,
      trial_end: null,
      items: { data: [{ price: { id: "price_growth" } }] },
      metadata: { school_id: "school1" }, // set by subscription_data.metadata at Checkout creation
    },
  },
};

const INVOICE_PAYMENT_FAILED_EVENT = {
  id: "evt_inv_1",
  type: "invoice.payment_failed",
  data: {
    object: {
      customer: "cus_123",
      subscription: "sub_123",
    },
  },
};

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid signature", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = makeRequest("{}", "bad-sig");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("processes checkout.session.completed — links customer/subscription to school", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(CHECKOUT_COMPLETED_EVENT as never);
    const fromMock = vi.fn()
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) }) // billing_events
      .mockReturnValueOnce({  // school_subscriptions update
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(CHECKOUT_COMPLETED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
    // school_subscriptions updated with stripe_customer_id and stripe_subscription_id
    expect(fromMock).toHaveBeenCalledWith("school_subscriptions");
  });

  it("processes customer.subscription.updated — uses metadata school_id (no DB lookup)", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(SUBSCRIPTION_UPDATED_EVENT as never);
    vi.mocked(priceIdToPlanCode).mockReturnValue("growth_monthly");

    // metadata.school_id is present → no school lookup DB call
    const fromMock = vi.fn()
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) }) // billing_events (1st)
      .mockReturnValueOnce({ // school_subscriptions update (2nd)
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(SUBSCRIPTION_UPDATED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledTimes(2); // billing_events + update, no school lookup
  });

  it("processes invoice.payment_failed — sets status to past_due", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(INVOICE_PAYMENT_FAILED_EVENT as never);

    const fromMock = vi.fn()
      .mockReturnValueOnce({ // lookup school by customer (1st)
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { school_id: "school1" }, error: null }),
      })
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) }) // billing_events (2nd)
      .mockReturnValueOnce({ // school_subscriptions update (3rd)
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(INVOICE_PAYMENT_FAILED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("processes customer.subscription.deleted — uses metadata school_id, sets status to canceled", async () => {
    const deletedEvent = {
      id: "evt_del_1",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_123", metadata: { school_id: "school1" } } },
    };
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(deletedEvent as never);

    // metadata.school_id present → no school lookup
    const fromMock = vi.fn()
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) }) // billing_events (1st)
      .mockReturnValueOnce({ // school_subscriptions update (2nd)
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(deletedEvent));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("returns 200 without update for duplicate non-checkout event", async () => {
    // SUBSCRIPTION_UPDATED_EVENT has metadata.school_id → no DB school lookup
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(SUBSCRIPTION_UPDATED_EVENT as never);

    const fromMock = vi.fn()
      .mockReturnValueOnce({ // billing_events insert returns duplicate (1st — no school lookup)
        insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(SUBSCRIPTION_UPDATED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledTimes(1); // billing_events only, no update
  });

  it("returns 200 without processing when school not found for non-checkout event (no metadata fallback)", async () => {
    // invoice.payment_failed has no metadata — exercises DB lookup fallback path
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(INVOICE_PAYMENT_FAILED_EVENT as never);

    const fromMock = vi.fn()
      .mockReturnValueOnce({ // school lookup by stripe_customer_id returns no data
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(INVOICE_PAYMENT_FAILED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fromMock).toHaveBeenCalledTimes(1); // only the lookup — no insert, no update
  });

  it("returns 200 without processing for duplicate stripe_event_id", async () => {
    // Use checkout.session.completed — school_id comes from metadata (no prior DB lookup),
    // so fromMock is called exactly once (the billing_events insert) before early return.
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(CHECKOUT_COMPLETED_EVENT as never);

    const fromMock = vi.fn()
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }), // unique violation
      });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const req = makeRequest(JSON.stringify(CHECKOUT_COMPLETED_EVENT));
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Only billing_events insert was attempted — no school_subscriptions update
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
