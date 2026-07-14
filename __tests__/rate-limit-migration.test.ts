import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../supabase/migrations/020_atomic_rate_limits.sql", import.meta.url),
  "utf8"
);

describe("atomic rate-limit migration", () => {
  it("serializes each key inside the transaction", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("INSERT INTO rate_limit_attempts");
    expect(sql).toContain("REVOKE ALL ON FUNCTION consume_rate_limit");
  });

  it("schedules bounded cleanup", () => {
    expect(sql).toContain("cleanup_rate_limit_attempts");
    expect(sql).toContain("minerval-rate-limit-cleanup");
    expect(sql).toContain("INTERVAL '1 day'");
  });
});
