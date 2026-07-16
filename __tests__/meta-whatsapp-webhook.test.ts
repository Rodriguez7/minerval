import { createHmac } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "@/lib/meta-whatsapp-webhook";
import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { NextRequest } from "next/server";

afterEach(() => {
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
});

describe("Meta WhatsApp webhook authentication", () => {
  it("uses a constant-time HMAC comparison", () => {
    process.env.WHATSAPP_APP_SECRET = "app-secret";
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const signature = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(verifyMetaWebhookSignature(body, signature)).toBe(true);
    expect(verifyMetaWebhookSignature(body, "sha256=" + "0".repeat(64))).toBe(false);
  });

  it("answers Meta's subscription challenge", async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "verify-me";
    const request = new NextRequest(
      "http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("rejects unsigned webhook events before database access", async () => {
    process.env.WHATSAPP_APP_SECRET = "app-secret";
    const request = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: JSON.stringify({ object: "whatsapp_business_account" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
