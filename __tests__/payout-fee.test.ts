import { describe, expect, it } from "vitest";
import {
  computePayoutFee,
  MIN_PAYOUT_REQUEST_AMOUNT,
  PAYOUT_FEE_BPS,
} from "@/lib/payout-fee";

describe("computePayoutFee", () => {
  it("retains the default 3% commission", () => {
    expect(PAYOUT_FEE_BPS).toBe(300);
    expect(computePayoutFee(100_000)).toEqual({
      feeAmount: 3_000,
      netAmount: 97_000,
    });
  });

  it("rounds the commission to the nearest currency unit", () => {
    expect(computePayoutFee(1_025)).toEqual({
      feeAmount: 31,
      netAmount: 994,
    });
  });

  it("keeps the minimum request at SerdiPay's 1,000-unit net minimum", () => {
    expect(MIN_PAYOUT_REQUEST_AMOUNT).toBe(1_031);
    expect(computePayoutFee(MIN_PAYOUT_REQUEST_AMOUNT).netAmount).toBe(1_000);
  });
});
