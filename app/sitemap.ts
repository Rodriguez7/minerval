import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.minerval.org";
const PUBLIC_PATHS = ["", "/privacy", "/terms", "/refunds"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return (["fr", "en"] as const).flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${APP_URL}/${locale}${path}`,
      changeFrequency: path ? ("yearly" as const) : ("monthly" as const),
      priority: path ? 0.5 : 1,
      alternates: {
        languages: {
          fr: `${APP_URL}/fr${path}`,
          en: `${APP_URL}/en${path}`,
        },
      },
    }))
  );
}
