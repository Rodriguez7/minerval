/**
 * Normalize a DRC mobile number to the SerdiPay format: 243 followed by the
 * nine-digit national number, without a leading plus sign.
 */
export function normalizeDrcMobilePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || /[^0-9+().\s-]/.test(trimmed)) return null;
  if ((trimmed.match(/\+/g) ?? []).length > 1 || (trimmed.includes("+") && !trimmed.startsWith("+"))) {
    return null;
  }

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00243")) digits = digits.slice(5);
  else if (digits.startsWith("243")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // Accept the commonly written international form +243 (0) 8xx xxx xxx.
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);

  if (!/^[89]\d{8}$/.test(digits)) return null;
  return `243${digits}`;
}
