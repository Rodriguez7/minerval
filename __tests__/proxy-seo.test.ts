import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("canonical host redirects", () => {
  it("redirects the apex host to www without changing the path or query", async () => {
    const request = new NextRequest("https://minerval.org/fr/privacy?source=google", {
      headers: { "x-forwarded-host": "minerval.org" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://www.minerval.org/fr/privacy?source=google"
    );
  });
});
