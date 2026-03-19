import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.ts"],
    exclude: ["e2e/**"],
    env: {
      STRIPE_SECRET_KEY: "sk_test_dummy_for_tests",
      STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_test",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_test",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
