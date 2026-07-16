import { describe, expect, it } from "vitest";
import {
  extractEmailAddress,
  getEmailConfigurationIssues,
} from "@/lib/email-config";

describe("email configuration", () => {
  it("extracts raw and display-name addresses", () => {
    expect(extractEmailAddress("support@minerval.org")).toBe("support@minerval.org");
    expect(extractEmailAddress("Minerval <NO-REPLY@minerval.org>")).toBe(
      "no-reply@minerval.org"
    );
    expect(extractEmailAddress("not-an-email")).toBeNull();
  });

  it("accepts one verified domain for sender and public contacts", () => {
    expect(
      getEmailConfigurationIssues({
        EMAIL_DOMAIN: "minerval.org",
        EMAIL_FROM: "Minerval <no-reply@minerval.org>",
        LEGAL_CONTACT_EMAIL: "support@minerval.org",
        PRIVACY_CONTACT_EMAIL: "privacy@minerval.org",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual([]);
  });

  it("reports malformed and split-domain configuration", () => {
    expect(
      getEmailConfigurationIssues({
        EMAIL_DOMAIN: "minerval.org",
        EMAIL_FROM: "Minerval <no-reply@minerval.app>",
        LEGAL_CONTACT_EMAIL: "bad",
        PRIVACY_CONTACT_EMAIL: "privacy@minerval.app",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual([
      "EMAIL_FROM does not use EMAIL_DOMAIN",
      "LEGAL_CONTACT_EMAIL is invalid",
      "PRIVACY_CONTACT_EMAIL does not use EMAIL_DOMAIN",
    ]);
  });
});
