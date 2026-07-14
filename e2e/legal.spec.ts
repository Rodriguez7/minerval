import { expect, test } from "@playwright/test";

test("publishes bilingual legal pages and links them from signup", async ({ page }) => {
  const privacyResponse = await page.goto("/fr/privacy");
  expect(privacyResponse?.headers()["content-security-policy"]).toContain("object-src 'none'");
  await expect(page.getByRole("heading", { name: "Politique de confidentialite" })).toBeVisible();
  await expect(page.getByText("Donnees traitees")).toBeVisible();

  await page.goto("/fr/terms");
  await expect(page.getByRole("heading", { name: "Conditions d'utilisation" })).toBeVisible();
  await expect(page.getByText(/commission Minerval de 3% ajoutee/)).toBeVisible();
  await expect(page.getByText(/commission Minerval de 3% est deduite/)).toBeVisible();

  await page.goto("/en/refunds");
  await expect(page.getByRole("heading", { name: "Cancellations, Refunds, and Disputes" })).toBeVisible();

  await page.goto("/fr/signup");
  const acceptance = page.getByRole("checkbox");
  await expect(acceptance).toHaveAttribute("required", "");
  await expect(page.getByRole("link", { name: "conditions d'utilisation" })).toHaveAttribute(
    "href",
    "/fr/terms"
  );
  await expect(page.getByRole("link", { name: "politique de confidentialite" })).toHaveAttribute(
    "href",
    "/fr/privacy"
  );
});

test("publishes crawler and install metadata", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /dashboard/");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/fr/privacy");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({
    short_name: "Minerval",
    display: "standalone",
  });

  const shareImage = await request.get("/opengraph-image");
  expect(shareImage.ok()).toBe(true);
  expect(shareImage.headers()["content-type"]).toContain("image/png");
});
