import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendOperationalAlert: vi.fn() }));

import { sendOperationalAlert } from "@/lib/email";
import { reportOperationalIssue } from "@/lib/operations";

describe("operations alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.RESEND_API_KEY = "re_test";
    process.env.OPERATIONS_ALERT_EMAIL = "ops@minerval.org";
  });

  it("logs structured context and sends a sanitized alert", async () => {
    await reportOperationalIssue({
      source: "stripe-webhook",
      message: "Subscription persistence failed",
      reference: "evt_123",
    });

    expect(sendOperationalAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@minerval.org",
        subject: "[CRITICAL] stripe-webhook",
        text: expect.stringContaining("evt_123"),
      })
    );
  });

  it("still logs when email alerting is not configured", async () => {
    delete process.env.OPERATIONS_ALERT_EMAIL;
    await reportOperationalIssue({ source: "payments", message: "Callback failed" });
    expect(console.error).toHaveBeenCalled();
    expect(sendOperationalAlert).not.toHaveBeenCalled();
  });
});
