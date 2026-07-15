import { describe, expect, it } from "vitest";
import { renderBrandedEmail } from "@/lib/email-template";

describe("branded email template", () => {
  it("renders the Minerval brand and structured transaction details", () => {
    const html = renderBrandedEmail({
      preview: "Retrait confirmé",
      eyebrow: "Retrait envoyé",
      title: "Votre retrait est en route",
      message: "Le transfert a été confirmé.",
      tone: "success",
      details: [
        { label: "Montant", value: "97 USD" },
        { label: "Réseau", value: "M-Pesa" },
      ],
      action: { label: "Ouvrir Minerval", url: "https://www.minerval.org" },
    });

    expect(html).toContain("Minerval");
    expect(html).toContain("#1d4ed8");
    expect(html).toContain("97 USD");
    expect(html).toContain("Ouvrir Minerval");
  });

  it("escapes dynamic content before placing it in HTML", () => {
    const html = renderBrandedEmail({
      preview: "Test",
      eyebrow: "Alerte",
      title: "<script>alert('x')</script>",
      message: "Payment & payout",
      note: "Reference: <evt_123>",
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Payment &amp; payout");
    expect(html).toContain("&lt;evt_123&gt;");
  });
});
