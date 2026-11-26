import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "./scripts/load-env-file.mjs";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)));

// PLAYWRIGHT_BASE_URL runs the suite against an already deployed environment
// instead of a local dev server. Values exported in the shell then win over
// .env.local, so that run can use the target environment's credentials.
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;

loadEnvFile(path.join(rootDir, ".env.local"), { override: !remoteBaseURL });

export default defineConfig({
  testDir: "./e2e",
  // e2e/production targets a deployed environment and has its own config.
  // Without this it would be picked up here and run against the local server.
  testIgnore: "**/production/**",
  // Remote runs cross the internet (and, with E2E_ORIGIN_URL, a tunnel) for every asset.
  timeout: remoteBaseURL ? 180_000 : 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: remoteBaseURL ?? "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: remoteBaseURL
    ? undefined
    : {
        command: "node scripts/run-next-dev-with-env.mjs",
        url: "http://127.0.0.1:3000/fr/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
