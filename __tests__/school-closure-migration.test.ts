import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../supabase/migrations/021_school_closure.sql", import.meta.url),
  "utf8"
);

describe("school closure migration", () => {
  it("requires an authenticated active owner and serializes closure", () => {
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("role = 'owner'");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("blocks unresolved money movement", () => {
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("status IN ('pending', 'processing')");
    expect(sql).toContain("pending_financial_activity");
  });

  it("revokes access but retains financial records", () => {
    expect(sql).toContain("payment_access_token = gen_random_uuid()::TEXT");
    expect(sql).toContain("UPDATE school_memberships");
    expect(sql).toContain("DELETE FROM school_invites");
    expect(sql).not.toMatch(/DELETE FROM (payment_requests|school_payouts|payment_events)/);
  });
});
