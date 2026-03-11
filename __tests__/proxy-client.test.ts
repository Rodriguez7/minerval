import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callProxy } from "../lib/proxy";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  process.env.PROXY_URL = "https://proxy.minerval.org";
  process.env.PROXY_SECRET = "test-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("callProxy", () => {
  it("sends required fields including telecom", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ payment: { sessionId: "123" } }),
    });

    await callProxy({
      amount: 1000,
      phone: "243812345678",
      reference: "pay-001",
      telecom: "AM",
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.telecom).toBe("AM");
    expect(callBody.phone).toBe("243812345678");
    expect(callBody.reference).toBe("pay-001");
    expect(mockFetch.mock.calls[0][1].headers["x-proxy-secret"]).toBe("test-secret");
  });

  it("includes callback_url when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ payment: { sessionId: "456" } }),
    });

    await callProxy({
      amount: 1000,
      phone: "243812345678",
      reference: "pay-002",
      telecom: "OM",
      callback_url: "https://www.minerval.org/api/serdipay/callback",
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.callback_url).toBe("https://www.minerval.org/api/serdipay/callback");
  });

  it("throws ProxyError on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "A simular transaction is already in process, Please Wait for 2 minutes" }),
    });

    await expect(
      callProxy({ amount: 1000, phone: "243812345678", reference: "pay-003", telecom: "AM" })
    ).rejects.toThrow();
  });
});
