import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assertSafeRestoreTarget,
  parseDatabaseUrl,
  postgresConnection,
} from "./database-backup-lib.mjs";

const backupPath = path.resolve(process.env.BACKUP_FILE || "");
if (!process.env.BACKUP_FILE) throw new Error("Missing BACKUP_FILE");
await access(backupPath);

const restoreUrl = parseDatabaseUrl(
  process.env.RESTORE_TEST_DATABASE_URL,
  "RESTORE_TEST_DATABASE_URL"
);
const productionUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  ? parseDatabaseUrl(
      process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
      "DATABASE_URL or SUPABASE_DB_URL"
    )
  : null;

assertSafeRestoreTarget(restoreUrl, productionUrl, {
  confirmation: process.env.RESTORE_CONFIRMATION,
  allowRemote: process.env.ALLOW_REMOTE_RESTORE_TEST,
});

const connection = postgresConnection(restoreUrl);
const restore = spawnSync(
  "pg_restore",
  [
    ...connection.args,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    backupPath,
  ],
  { env: { ...process.env, ...connection.env }, encoding: "utf8" }
);
if (restore.error?.code === "ENOENT") throw new Error("pg_restore is not installed");
if (restore.status !== 0) {
  throw new Error(`pg_restore failed: ${restore.stderr?.trim() || "unknown error"}`);
}

const validation = spawnSync(
  "psql",
  [
    ...connection.args,
    "--tuples-only",
    "--command",
    "SELECT COUNT(*) FROM schools; SELECT COUNT(*) FROM students; SELECT COUNT(*) FROM payment_requests; SELECT COUNT(*) FROM school_payouts;",
  ],
  { env: { ...process.env, ...connection.env }, encoding: "utf8" }
);
if (validation.error?.code === "ENOENT") throw new Error("psql is not installed");
if (validation.status !== 0) {
  throw new Error(`Restore validation failed: ${validation.stderr?.trim() || "unknown error"}`);
}

console.log("Restore drill passed for critical Minerval tables.");
console.log(validation.stdout.trim());
