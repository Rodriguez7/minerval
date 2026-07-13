import { describe, it, expect } from "vitest";
import { computeFee, DEFAULT_PARENT_FEE_BPS } from "@/lib/fee";

describe("computeFee", () => {
  it("computes the default 3% fee on 1500 FC", () => {
    expect(computeFee(1500, DEFAULT_PARENT_FEE_BPS)).toEqual({
      feeAmount: 45,
      totalAmount: 1545,
    });
  });

  it("computes a 3% fee on 1000 FC (exact)", () => {
    // 1000 * 300 / 10000 = 30.0 → 30
    expect(computeFee(1000, 300)).toEqual({ feeAmount: 30, totalAmount: 1030 });
  });

  it("returns zero fee when feeBps is 0", () => {
    expect(computeFee(1500, 0)).toEqual({ feeAmount: 0, totalAmount: 1500 });
  });

  it("returns zero amounts when amountDue is 0", () => {
    expect(computeFee(0, DEFAULT_PARENT_FEE_BPS)).toEqual({ feeAmount: 0, totalAmount: 0 });
  });

  it("rounds half up (0.5 rounds to 1)", () => {
    // 200 * 250 / 10000 = 5.0 (exact)
    expect(computeFee(200, 250)).toEqual({ feeAmount: 5, totalAmount: 205 });
  });
});
