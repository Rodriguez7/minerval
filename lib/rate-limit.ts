import { getAdminClient } from "@/lib/supabase";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  if (!key || key.length > 500 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new Error("Invalid rate-limit options");
  }
  if (!Number.isFinite(windowMs) || windowMs < 1 || windowMs > 86_400_000) {
    throw new Error("Invalid rate-limit window");
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });

  if (error || !isRateLimitPayload(data)) {
    console.error("[rate-limit] atomic limiter unavailable", error?.message ?? "invalid response");
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining,
    retryAfterSeconds: data.retry_after_seconds,
  };
}

function isRateLimitPayload(value: unknown): value is {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
} {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.allowed === "boolean" &&
    Number.isSafeInteger(payload.remaining) &&
    (payload.remaining as number) >= 0 &&
    Number.isSafeInteger(payload.retry_after_seconds) &&
    (payload.retry_after_seconds as number) >= 0
  );
}
