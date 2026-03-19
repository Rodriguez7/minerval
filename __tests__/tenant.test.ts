// minerval/__tests__/tenant.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthenticatedSchool } from "../lib/auth";

// Mock next/navigation (redirect throws in tests)
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

vi.mock("../lib/supabase", () => ({
  createSSRClient: vi.fn(),
}));

import { getTenantContext } from "../lib/tenant";
import { createSSRClient } from "../lib/supabase";
import { redirect } from "next/navigation";

const mockUser = { id: "user-1", email: "admin@school.com" };

// IMPORTANT: school_subscriptions is nested inside schools (no direct FK
// between school_memberships and school_subscriptions — joins via schools).
const mockMembershipRow = {
  id: "mem-1",
  role: "owner",
  status: "active",
  schools: {
    id: "school-1",
    name: "Test School",
    code: "test",
    admin_email: "admin@school.com",
    payment_access_token: "tok123",
    student_id_prefix: "TST",
    student_id_seq: 0,
    currency: "USD",
    created_at: "2024-01-01",
    billing_email: null,
    billing_contact: null,
    timezone: "UTC",
    support_tier: "standard",
    school_subscriptions: {
      plan_code: "starter_free",
      status: "active",
      trial_ends_at: null,
      current_period_end: null,
      billing_exempt: false,
      stripe_customer_id: null,
      plans: {
        code: "starter_free",
        name: "Starter",
        monthly_price_usd: 0,
        can_branded_receipts: false,
        can_rich_reports: false,
        can_bulk_ops: false,
        can_accounting_export: false,
        can_advanced_analytics: false,
        max_students: null,
      },
    },
  },
};

function mockSupabaseClient(opts: {
  user?: typeof mockUser | null;
  membershipData?: typeof mockMembershipRow | null;
  membershipError?: object | null;
}) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: opts.membershipData ?? null,
        error: opts.membershipError ?? null,
      }),
    }),
  };
  vi.mocked(createSSRClient).mockResolvedValue(client as never);
  return client;
}

describe("getTenantContext", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects to /login when user is not authenticated", async () => {
    mockSupabaseClient({ user: null });
    await expect(getTenantContext()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /onboarding/school when authenticated but no membership", async () => {
    vi.mocked(createSSRClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid1", email: "a@b.com" } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as never);

    await expect(getTenantContext()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/onboarding/school");
  });

  it("returns fully-shaped TenantContext on success", async () => {
    mockSupabaseClient({ user: mockUser, membershipData: mockMembershipRow });
    const ctx = await getTenantContext();

    expect(ctx.user).toEqual({ id: "user-1", email: "admin@school.com" });
    expect(ctx.school.id).toBe("school-1");
    expect(ctx.school.timezone).toBe("UTC");
    expect(ctx.membership.role).toBe("owner");
    expect(ctx.plan.code).toBe("starter_free");
    expect(ctx.plan.can_branded_receipts).toBe(false);
    expect(ctx.subscription.billing_exempt).toBe(false);
  });

  it("redirects to /login when membership exists but subscription is missing", async () => {
    const membershipWithNoSubscription = {
      ...mockMembershipRow,
      schools: {
        ...mockMembershipRow.schools,
        school_subscriptions: null,
      },
    };
    mockSupabaseClient({ user: mockUser, membershipData: membershipWithNoSubscription });
    await expect(getTenantContext()).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("queries memberships with user_id and status=active filter", async () => {
    const client = mockSupabaseClient({ user: mockUser, membershipData: mockMembershipRow });
    await getTenantContext();

    const fromCall = client.from.mock.calls[0];
    expect(fromCall[0]).toBe("school_memberships");

    const eqCalls = client.from.mock.results[0].value.eq.mock.calls;
    expect(eqCalls).toContainEqual(["user_id", "user-1"]);
    expect(eqCalls).toContainEqual(["status", "active"]);
  });
});

describe("getAuthenticatedSchool (shim)", () => {
  it("returns the school from getTenantContext", async () => {
    mockSupabaseClient({ user: mockUser, membershipData: mockMembershipRow });
    const school = await getAuthenticatedSchool();
    expect(school.id).toBe("school-1");
    expect(school.code).toBe("test");
  });
});
