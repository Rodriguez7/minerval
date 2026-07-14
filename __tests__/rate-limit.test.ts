import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));

import { consumeRateLimit } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase";

describe("atomic rate limiter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses one database RPC and maps its result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: true, remaining: 3, retry_after_seconds: 0 },
      error: null,
    });
    vi.mocked(getAdminClient).mockReturnValue({ rpc } as never);

    await expect(
      consumeRateLimit({ key: "payment:school:ip", limit: 5, windowMs: 300_000 })
    ).resolves.toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "payment:school:ip",
      p_limit: 5,
      p_window_seconds: 300,
    });
  });

  it("fails closed when the atomic database function is unavailable", async () => {
    vi.mocked(getAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "missing function" } }),
    } as never);

    await expect(
      consumeRateLimit({ key: "lookup:school:ip", limit: 15, windowMs: 60_000 })
    ).resolves.toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
  });

  it("rejects invalid configuration before touching the database", async () => {
    await expect(
      consumeRateLimit({ key: "", limit: 0, windowMs: 0 })
    ).rejects.toThrow("Invalid rate-limit options");
    expect(getAdminClient).not.toHaveBeenCalled();
  });
});
