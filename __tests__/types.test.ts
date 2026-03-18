// minerval/__tests__/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type {
  MembershipRole,
  SubscriptionStatus,
  Plan,
  Membership,
  Subscription,
  TenantContext,
} from "../lib/types";

describe("SaaS types", () => {
  it("MembershipRole is a union of valid roles", () => {
    const role: MembershipRole = "owner";
    expectTypeOf(role).toMatchTypeOf<"owner" | "admin" | "finance" | "viewer">();
  });

  it("Plan has typed entitlement columns (not JSON)", () => {
    const plan: Plan = {
      code: "starter_free",
      name: "Starter",
      monthly_price_usd: 0,
      can_branded_receipts: false,
      can_rich_reports: false,
      can_bulk_ops: false,
      can_accounting_export: false,
      can_advanced_analytics: false,
      max_students: null,
    };
    expectTypeOf(plan.can_branded_receipts).toBeBoolean();
    expectTypeOf(plan.max_students).toMatchTypeOf<number | null>();
  });

  it("TenantContext has all required fields", () => {
    expectTypeOf<TenantContext>().toHaveProperty("user");
    expectTypeOf<TenantContext>().toHaveProperty("school");
    expectTypeOf<TenantContext>().toHaveProperty("membership");
    expectTypeOf<TenantContext>().toHaveProperty("plan");
    expectTypeOf<TenantContext>().toHaveProperty("subscription");
  });

  it("School interface includes billing fields from migration 006", () => {
    expectTypeOf<import("../lib/types").School>().toHaveProperty("billing_email");
    expectTypeOf<import("../lib/types").School>().toHaveProperty("billing_contact");
    expectTypeOf<import("../lib/types").School>().toHaveProperty("timezone");
    expectTypeOf<import("../lib/types").School>().toHaveProperty("support_tier");
  });
});
