import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("public web hardening and metadata", () => {
  it("sets a restrictive baseline CSP and browser security headers", async () => {
    const rules = await nextConfig.headers?.();
    const headers = Object.fromEntries(
      (rules?.[0]?.headers ?? []).map((header) => [header.key, header.value])
    );

    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("base-uri 'self'");
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("keeps private and transactional routes out of crawlers", () => {
    const value = robots();
    const rules = Array.isArray(value.rules) ? value.rules[0] : value.rules;
    expect(rules.disallow).toContain("/api/");
    expect(rules.disallow).toContain("/dashboard/");
    expect(rules.disallow).toContain("/pay/");
  });

  it("publishes only localized public pages in the sitemap", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(8);
    expect(entries.some((entry) => entry.url.endsWith("/fr/privacy"))).toBe(true);
    expect(entries.some((entry) => entry.url.includes("/dashboard"))).toBe(false);
  });

  it("provides an installable application manifest", () => {
    expect(manifest()).toMatchObject({
      short_name: "Minerval",
      start_url: "/fr/",
      display: "standalone",
      theme_color: "#1d4ed8",
    });
  });
});
