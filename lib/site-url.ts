const DEFAULT_SITE_URL = "https://www.minerval.org";

export function getCanonicalSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL;

  try {
    const url = new URL(configured);

    // Production uses www as the canonical host. Normalize an accidentally
    // configured apex URL so metadata, robots, and sitemaps cannot disagree.
    if (url.hostname === "minerval.org") {
      url.hostname = "www.minerval.org";
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
