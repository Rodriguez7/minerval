import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendWhatsAppTemplate } from "@/lib/meta-whatsapp";

beforeEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_GRAPH_API_VERSION = "v99.0";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_GRAPH_API_VERSION;
});

describe("Meta WhatsApp template client", () => {
  it("sends body variables and a dynamic URL button", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.123" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppTemplate({
      to: "243812345678",
      templateName: "minerval_payment_reminder_v1",
      locale: "fr",
      bodyParameters: ["Chantal", "Ecole Test", "Alice", "15 000", "FC"],
      buttonToken: "secure-token",
    });

    expect(result).toEqual({ messageId: "wamid.123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v99.0/123456/messages",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe("243812345678");
    expect(body.template.language).toEqual({ code: "fr" });
    expect(body.template.components[1]).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "secure-token" }],
    });
  });

  it("does not silently succeed when configuration is missing", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(
      sendWhatsAppTemplate({
        to: "243812345678",
        templateName: "template",
        locale: "fr",
        bodyParameters: [],
      })
    ).rejects.toMatchObject({
      code: "configuration_missing",
      retryable: false,
    });
  });

  it("marks Meta server errors as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Temporary", code: 2 } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      )
    );

    await expect(
      sendWhatsAppTemplate({
        to: "243812345678",
        templateName: "template",
        locale: "fr",
        bodyParameters: [],
      })
    ).rejects.toMatchObject({ code: "2", retryable: true });
  });
});
