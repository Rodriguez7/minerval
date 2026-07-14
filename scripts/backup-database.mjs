import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseDatabaseUrl, postgresConnection } from "./database-backup-lib.mjs";

const databaseUrl = parseDatabaseUrl(
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  "DATABASE_URL or SUPABASE_DB_URL"
);
const backupDir = path.resolve(process.env.BACKUP_DIR || ".tmp/backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `minerval-${timestamp}.dump`);
await mkdir(backupDir, { recursive: true });

const connection = postgresConnection(databaseUrl);
const dump = spawnSync(
  "pg_dump",
  [
    ...connection.args,
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--file",
    backupPath,
  ],
  {
    env: { ...process.env, ...connection.env },
    encoding: "utf8",
  }
);

if (dump.error?.code === "ENOENT") {
  throw new Error("pg_dump is not installed");
}
if (dump.status !== 0) {
  throw new Error(`pg_dump failed: ${dump.stderr?.trim() || "unknown error"}`);
}

const verify = spawnSync("pg_restore", ["--list", backupPath], {
  encoding: "utf8",
});
if (verify.error?.code === "ENOENT") throw new Error("pg_restore is not installed");
if (verify.status !== 0 || !verify.stdout.includes("TABLE")) {
  throw new Error("Backup integrity verification failed");
}

const contents = await readFile(backupPath);
const details = await stat(backupPath);
const metadata = {
  created_at: new Date().toISOString(),
  backup_file: path.basename(backupPath),
  bytes: details.size,
  sha256: createHash("sha256").update(contents).digest("hex"),
  verified_with_pg_restore: true,
};
await writeFile(`${backupPath}.json`, `${JSON.stringify(metadata, null, 2)}\n`, {
  mode: 0o600,
});

console.log(JSON.stringify(metadata, null, 2));
