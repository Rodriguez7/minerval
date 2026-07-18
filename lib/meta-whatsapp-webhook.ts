import { createHmac, timingSafeEqual } from "crypto";

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;

  const supplied = signature.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export const WHATSAPP_STATUS_RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
  cancelled: 5,
};
