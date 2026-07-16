import { defineConfig } from "@playwright/test";

/**
 * Runs the e2e/production suite against a deployed environment.
 *
 * Deliberately separate from playwright.config.mjs: that config boots a local
 * dev server and loads .env.local, neither of which should happen when the
 * target is real production.
 */
export default defineConfig({
  testDir: "./e2e/production",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  // Production checks cross the public internet, so a transient blip should not
  // page anyone. A real breakage fails every retry.
  retries: 2,
  reporter: "line",
  use: {
    baseURL: process.env.PRODUCTION_URL ?? "https://www.minerval.org",
    headless: true,
    ignoreHTTPSErrors: false,
  },
});
