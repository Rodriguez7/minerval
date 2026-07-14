import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("@/lib/school-export", () => ({ buildSchoolExport: vi.fn() }));

import { GET } from "@/app/api/dashboard/account/export/route";
import { consumeRateLimit } from "@/lib/rate-limit";
import { buildSchoolExport } from "@/lib/school-export";
import { getTenantContext } from "@/lib/tenant";

const context = {
  user: { id: "user-1" },
  school: { id: "school-1", code: "ecole-test" },
  membership: { role: "owner" },
};

describe("school account export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantContext).mockResolvedValue(context as never);
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 0,
    });
  });

  it("allows only the school owner", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...context,
      membership: { role: "admin" },
    } as never);
    const response = await GET();
    expect(response.status).toBe(403);
    expect(buildSchoolExport).not.toHaveBeenCalled();
  });

  it("rate limits repeated full exports", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
    });
    const response = await GET();
    expect(response.status).toBe(429);
    expect(buildSchoolExport).not.toHaveBeenCalled();
  });

  it("downloads a private no-store JSON archive", async () => {
    vi.mocked(buildSchoolExport).mockResolvedValue({
      schema_version: 1,
      generated_at: "2026-07-14T00:00:00.000Z",
      school: { id: "school-1" },
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="minerval-ecole-test-export.json"'
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ schema_version: 1 });
  });

  it("does not leak internal failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(buildSchoolExport).mockRejectedValue(new Error("database details"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Impossible de generer l'export." });
  });
});
