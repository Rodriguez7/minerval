import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";

export function generateReceiptAccessToken() {
  return randomBytes(18).toString("hex");
}

export function getSerdiPayCallbackSecret() {
  const secret = process.env.SERDIPAY_CALLBACK_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing SERDIPAY_CALLBACK_SECRET");
  }

  return secret;
}

export function buildSerdiPayCallbackUrl(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (!appUrl) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }

  const secret = getSerdiPayCallbackSecret();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${appUrl}${normalizedPath}?secret=${encodeURIComponent(secret)}`;
}

export function verifySerdiPayCallback(req: NextRequest) {
  let expectedSecret: string;

  try {
    expectedSecret = getSerdiPayCallbackSecret();
  } catch {
    return { ok: false as const, status: 503, error: "Callback not configured" };
  }

  const receivedSecret = req.nextUrl.searchParams.get("secret");
  if (receivedSecret !== expectedSecret) {
    return { ok: false as const, status: 401, error: "Non autorise" };
  }

  return { ok: true as const };
}
