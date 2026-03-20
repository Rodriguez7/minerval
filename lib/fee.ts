/**
 * Compute the parent transaction fee.
 *
 * @param amountDue  School fee in smallest currency unit (e.g. Francs Congolais)
 * @param feeBps     Fee in basis points (1 bps = 0.01%). 275 = 2.75%.
 * @returns          feeAmount (the fee) and totalAmount (what the parent pays)
 */
export function computeFee(
  amountDue: number,
  feeBps: number
): { feeAmount: number; totalAmount: number } {
  const feeAmount = Math.round((amountDue * feeBps) / 10000);
  return { feeAmount, totalAmount: amountDue + feeAmount };
}
