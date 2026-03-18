import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "./scripts/load-env-file.mjs";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)));

loadEnvFile(path.join(rootDir, ".env.local"), { override: true });

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "node scripts/run-next-dev-with-env.mjs",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
