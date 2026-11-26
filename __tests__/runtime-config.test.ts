import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const workflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
const nvmrc = readFileSync(join(root, ".nvmrc"), "utf8").trim();
const healthRoute = readFileSync(join(root, "app/api/health/route.ts"), "utf8");

describe("Node.js runtime configuration", () => {
  it("keeps local development, CI, and the production image on Node 22", () => {
    expect(packageJson.engines.node).toBe("22.x");
    expect(nvmrc).toBe("22");
    expect(workflow).toMatch(/node-version:\s*22/);
    // Every stage of the production image must use the Node 22 base.
    const baseImages = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((m) => m[1]);
    expect(baseImages.length).toBeGreaterThan(0);
    for (const image of baseImages) expect(image).toMatch(/^node:22(-|$)/);
    expect(healthRoute).toContain("EXPECTED_NODE_MAJOR = 22");
  });

  it("does not retain the end-of-life Node 20 deployment setting", () => {
    expect(workflow).not.toMatch(/node-version:\s*20/);
    expect(dockerfile).not.toMatch(/^FROM\s+node:20/m);
  });
});
