import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/022_user_deletion_retention.sql"),
  "utf8"
);

describe("user deletion retention migration", () => {
  it("retains payout records while removing a deleted user reference", () => {
    expect(sql).toMatch(/ALTER TABLE school_payouts[\s\S]*requested_by DROP NOT NULL/);
    expect(sql).toMatch(
      /FOREIGN KEY \(requested_by\)[\s\S]*REFERENCES auth\.users\(id\)[\s\S]*ON DELETE SET NULL/
    );
  });

  it("retains invitation audit records while removing a deleted user reference", () => {
    expect(sql).toMatch(/ALTER TABLE school_invites[\s\S]*invited_by DROP NOT NULL/);
    expect(sql).toMatch(
      /FOREIGN KEY \(invited_by\)[\s\S]*REFERENCES auth\.users\(id\)[\s\S]*ON DELETE SET NULL/
    );
  });

  it("does not delete financial, invitation, school, or audit rows", () => {
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
