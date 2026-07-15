import { afterEach, describe, expect, it } from "vitest";
import {
  LEGAL_VERSION,
  REQUIRED_LEGAL_ENV,
  getLegalDocument,
  getLegalOperator,
} from "@/lib/legal";

describe("legal configuration and copy", () => {
  afterEach(() => {
    for (const key of REQUIRED_LEGAL_ENV) delete process.env[key];
    delete process.env.LEGAL_ENTITY_ADDRESS;
  });

  it("uses configured operator identity without exposing placeholders", () => {
    process.env.LEGAL_ENTITY_NAME = "Example Education SARL";
    process.env.LEGAL_ENTITY_ADDRESS = "Kinshasa, RDC";
    process.env.LEGAL_CONTACT_EMAIL = "legal@example.com";
    process.env.PRIVACY_CONTACT_EMAIL = "privacy@example.com";

    expect(getLegalOperator()).toEqual({
      name: "Example Education SARL",
      address: "Kinshasa, RDC",
      contactEmail: "legal@example.com",
      privacyEmail: "privacy@example.com",
    });
  });

  it("allows the operator address to remain unpublished", () => {
    process.env.LEGAL_ENTITY_NAME = "Minerval";
    process.env.LEGAL_CONTACT_EMAIL = "legal@minerval.org";
    process.env.PRIVACY_CONTACT_EMAIL = "privacy@minerval.org";

    expect(getLegalOperator()).toMatchObject({
      name: "Minerval",
      address: null,
    });
  });

  it("keeps parent and school commissions transparent in both languages", () => {
    for (const locale of ["fr", "en"] as const) {
      const terms = getLegalDocument(locale, "terms");
      const feeText = terms.sections.flatMap((section) => section.paragraphs ?? []).join(" ");
      expect(feeText).toContain("3%");
      expect(feeText).toContain("29");
      expect(feeText).toContain("99");
    }
  });

  it("publishes a stable legal version for acceptance records", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
