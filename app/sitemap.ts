import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-url";

const PUBLIC_PATHS = ["", "/privacy", "/terms", "/refunds"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getCanonicalSiteUrl();

  return (["fr", "en"] as const).flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${appUrl}/${locale}${path}`,
      changeFrequency: path ? ("yearly" as const) : ("monthly" as const),
      priority: path ? 0.5 : 1,
      alternates: {
        languages: {
          fr: `${appUrl}/fr${path}`,
          en: `${appUrl}/en${path}`,
        },
      },
    }))
  );
}
