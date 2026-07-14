import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/production-health.yml"),
  "utf8"
);

describe("production deep health monitoring", () => {
  it("runs every ten minutes and can be triggered manually", () => {
    expect(workflow).toContain('cron: "*/10 * * * *"');
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("authenticates without embedding the secret", () => {
    expect(workflow).toContain("secrets.MINERVAL_HEALTHCHECK_SECRET");
    expect(workflow).toContain('Authorization: Bearer $HEALTHCHECK_SECRET');
    expect(workflow).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{20,}/);
  });

  it("fails on non-200 or degraded dependency responses", () => {
    expect(workflow).toContain('[[ "$http_status" != "200" ]]');
    expect(workflow).toContain('.status == "ok"');
    expect(workflow).toContain("[.checks[] | .ok] | all");
  });
});
