export const PAYOUT_FEE_BPS = 300;
export const MIN_PAYOUT_REQUEST_AMOUNT = 1031;

/**
 * The requested amount is deducted from the school's available balance.
 * Minerval retains the fee and sends the remaining net amount to the school.
 */
export function computePayoutFee(
  requestedAmount: number,
  feeBps = PAYOUT_FEE_BPS
): { feeAmount: number; netAmount: number } {
  const feeAmount = Math.round((requestedAmount * feeBps) / 10000);
  return { feeAmount, netAmount: requestedAmount - feeAmount };
}
