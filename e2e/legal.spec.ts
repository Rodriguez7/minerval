import { expect, test } from "@playwright/test";

test("publishes bilingual legal pages and links them from signup", async ({ page }) => {
  await page.goto("/fr/privacy");
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
