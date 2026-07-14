import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/fr/", "/en/", "/fr/privacy", "/en/privacy", "/fr/terms", "/en/terms", "/fr/refunds", "/en/refunds"],
      disallow: [
        "/api/",
        "/dashboard/",
        "/onboarding/",
        "/pay/",
        "/invite/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/fr/dashboard/",
        "/en/dashboard/",
        "/fr/onboarding/",
        "/en/onboarding/",
        "/fr/pay/",
        "/en/pay/",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
