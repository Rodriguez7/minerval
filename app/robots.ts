import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getCanonicalSiteUrl();

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
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
