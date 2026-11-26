import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase/migrations");
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({ file, sql: readFileSync(join(migrationsDir, file), "utf8") }));

const hardening = migrations.find((m) => m.file.startsWith("027_"))?.sql ?? "";

// RLS helpers stay callable by API roles on purpose (see migration 027).
const RLS_HELPERS = new Set(["is_school_member", "is_school_member_with_role"]);

function securityDefinerFunctions() {
  const names = new Set<string>();
  for (const { sql } of migrations) {
    const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\$\$/gi;
    for (const match of sql.matchAll(pattern)) {
      if (/SECURITY\s+DEFINER/i.test(match[2])) names.add(match[1].toLowerCase());
    }
  }
  return [...names];
}

describe("function access for Supabase API roles", () => {
  it("revokes anon access to every SECURITY DEFINER function except RLS helpers", () => {
    const definers = securityDefinerFunctions();
    expect(definers.length).toBeGreaterThan(5);

    const uncovered = definers.filter(
      (name) => !RLS_HELPERS.has(name) && !hardening.includes(`'${name}'`)
    );
    expect(uncovered, "add new SECURITY DEFINER functions to migration 027 or a later revoke").toEqual([]);
  });

  it("keeps server-only functions away from signed-in users too", () => {
    const serverOnly = hardening.slice(0, hardening.indexOf("FROM anon, authenticated"));
    for (const name of ["claim_whatsapp_messages", "consume_rate_limit", "cancel_student_whatsapp_messages"]) {
      expect(serverOnly).toContain(`'${name}'`);
    }
  });

  it("stops granting EXECUTE on future functions to the API roles", () => {
    expect(hardening).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated/
    );
  });
});
