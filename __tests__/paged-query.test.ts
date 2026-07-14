import { describe, expect, it, vi } from "vitest";
import { collectAllPages } from "@/lib/paged-query";

describe("collectAllPages", () => {
  it("loads past the normal 1,000-row API limit", async () => {
    const source = Array.from({ length: 2_501 }, (_, id) => ({ id }));
    const loader = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const rows = await collectAllPages(loader, 1_000);

    expect(rows).toHaveLength(2_501);
    expect(rows.at(-1)).toEqual({ id: 2_500 });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("stops immediately on an empty result", async () => {
    const loader = vi.fn(async () => ({ data: [], error: null }));
    await expect(collectAllPages(loader)).resolves.toEqual([]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not hide database errors", async () => {
    await expect(
      collectAllPages(async () => ({ data: null, error: { message: "database unavailable" } }))
    ).rejects.toThrow("database unavailable");
  });
});
