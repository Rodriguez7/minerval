import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getCanonicalSiteUrl } from "@/lib/site-url";

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

  it("normalizes the production apex to the www canonical origin", () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://minerval.org/";

    try {
      expect(getCanonicalSiteUrl()).toBe("https://www.minerval.org");
      expect(sitemap().every((entry) => entry.url.startsWith("https://www.minerval.org/"))).toBe(true);
      expect(robots().host).toBe("https://www.minerval.org");
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previous;
    }
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
