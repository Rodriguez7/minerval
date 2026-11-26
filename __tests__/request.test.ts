import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/request";

describe("getClientIp", () => {
  it("prefers the visitor IP Cloudflare sets over x-forwarded-for", () => {
    // Behind Cloudflare Tunnel + Traefik, x-forwarded-for is rewritten to the
    // tunnel's address, so every visitor would share one rate-limit bucket.
    const headers = new Headers({
      "cf-connecting-ip": "41.243.12.7",
      "x-forwarded-for": "172.18.0.1",
    });

    expect(getClientIp(headers)).toBe("41.243.12.7");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "41.243.12.7, 10.0.0.2" });

    expect(getClientIp(headers)).toBe("41.243.12.7");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "41.243.12.7" }))).toBe("41.243.12.7");
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("ignores a blank cf-connecting-ip", () => {
    const headers = new Headers({
      "cf-connecting-ip": "  ",
      "x-forwarded-for": "41.243.12.7",
    });

    expect(getClientIp(headers)).toBe("41.243.12.7");
  });
});
