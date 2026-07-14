import { describe, expect, it } from "vitest";
import {
  buildPageHref,
  clampPage,
  getPageRange,
  getTotalPages,
  parsePage,
} from "@/lib/pagination";

describe("pagination helpers", () => {
  it("normalizes invalid pages", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(["3", "4"])).toBe(3);
  });

  it("clamps and converts a page to an inclusive database range", () => {
    expect(getTotalPages(201, 50)).toBe(5);
    expect(clampPage(99, 201, 50)).toBe(5);
    expect(getPageRange(5, 50)).toEqual({ from: 200, to: 249 });
  });

  it("preserves filters while replacing the page", () => {
    expect(
      buildPageHref(
        "/dashboard/reports",
        { from: "2026-07-01", paymentStatus: "success", page: "2" },
        3
      )
    ).toBe("/dashboard/reports?from=2026-07-01&paymentStatus=success&page=3");
    expect(buildPageHref("/dashboard/students", { page: "2" }, 1)).toBe(
      "/dashboard/students"
    );
  });
});
