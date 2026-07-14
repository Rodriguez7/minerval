import { describe, expect, it } from "vitest";

describe("database backup safety", () => {
  it("keeps passwords out of process arguments", async () => {
    const { parseDatabaseUrl, postgresConnection } = await import(
      "../scripts/database-backup-lib.mjs"
    );
    const connection = postgresConnection(
      parseDatabaseUrl("postgresql://user:secret@localhost:5432/minerval", "DATABASE_URL")
    );
    expect(connection.args.join(" ")).not.toContain("secret");
    expect(connection.env.PGPASSWORD).toBe("secret");
  });

  it("refuses a production restore", async () => {
    const { assertSafeRestoreTarget, parseDatabaseUrl } = await import(
      "../scripts/database-backup-lib.mjs"
    );
    const production = parseDatabaseUrl(
      "postgresql://user:secret@db.example.com:5432/postgres",
      "DATABASE_URL"
    );
    expect(() =>
      assertSafeRestoreTarget(production, production, {
        confirmation: "RESTORE_TO_DISPOSABLE_DATABASE",
        allowRemote: "yes",
      })
    ).toThrow("production database");
  });

  it("requires explicit confirmation even for localhost", async () => {
    const { assertSafeRestoreTarget, parseDatabaseUrl } = await import(
      "../scripts/database-backup-lib.mjs"
    );
    const local = parseDatabaseUrl(
      "postgresql://user:secret@localhost:5432/restore_test",
      "RESTORE_TEST_DATABASE_URL"
    );
    expect(() => assertSafeRestoreTarget(local, null)).toThrow("RESTORE_CONFIRMATION");
  });
});
