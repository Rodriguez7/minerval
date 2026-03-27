import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/tenant", () => ({ getTenantContext: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updatePricingPolicy } from "@/app/actions/settings";
import { getTenantContext } from "@/lib/tenant";
import { getAdminClient } from "@/lib/supabase";
import type { TenantContext } from "@/lib/types";

function mockTenant(role: "owner" | "admin" | "finance" | "viewer") {
  vi.mocked(getTenantContext).mockResolvedValue({
    user: { id: "uid1", email: "admin@school.com" },
    school: { id: "school1" } as TenantContext["school"],
    membership: { id: "mem1", role, status: "active" },
    plan: {} as TenantContext["plan"],
    subscription: {} as TenantContext["subscription"],
  });
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("updatePricingPolicy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns French unauthorized error for viewer", async () => {
    mockTenant("viewer");
    const fd = makeFormData({ parentFeeBps: "275", feeDisplayMode: "visible_line_item" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBe("Non autorise");
  });

  it("returns French unauthorized error for finance", async () => {
    mockTenant("finance");
    const fd = makeFormData({ parentFeeBps: "275", feeDisplayMode: "visible_line_item" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBe("Non autorise");
  });

  it("returns validation error for out-of-range bps (owner, no DB call)", async () => {
    mockTenant("owner");
    // Auth passes, Zod rejects — no DB call needed
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const fd = makeFormData({ parentFeeBps: "9999", feeDisplayMode: "visible_line_item" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBeTruthy();
  });

  it("returns validation error for invalid fee_display_mode (owner, no DB call)", async () => {
    mockTenant("owner");
    vi.mocked(getAdminClient).mockReturnValue({ from: vi.fn() } as never);
    const fd = makeFormData({ parentFeeBps: "275", feeDisplayMode: "bad_value" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBeTruthy();
  });

  it("updates pricing policy for owner", async () => {
    mockTenant("owner");
    const fromMock = vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const fd = makeFormData({ parentFeeBps: "300", feeDisplayMode: "hidden" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBeUndefined();
    expect(result?.success).toBe(true);
  });

  it("updates pricing policy for admin", async () => {
    mockTenant("admin");
    const fromMock = vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const fd = makeFormData({ parentFeeBps: "200", feeDisplayMode: "visible_line_item" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.success).toBe(true);
  });

  it("returns error on DB failure", async () => {
    mockTenant("owner");
    const fromMock = vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
    });
    vi.mocked(getAdminClient).mockReturnValue({ from: fromMock } as never);

    const fd = makeFormData({ parentFeeBps: "275", feeDisplayMode: "visible_line_item" });
    const result = await updatePricingPolicy(undefined, fd);
    expect(result?.error).toBeTruthy();
  });
});
