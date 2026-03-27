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
  const admin = getAdminClient();
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count } = await admin
    .from("rate_limit_attempts")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  const currentCount = count ?? 0;

  if (currentCount >= limit) {
    const { data: oldest } = await admin
      .from("rate_limit_attempts")
      .select("created_at")
      .eq("key", key)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const resetAt = oldest
      ? new Date(oldest.created_at).getTime() + windowMs
      : Date.now() + windowMs;

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }

  await admin.from("rate_limit_attempts").insert({ key });

  // Prune stale entries for this key (fire-and-forget)
  admin
    .from("rate_limit_attempts")
    .delete()
    .eq("key", key)
    .lt("created_at", windowStart)
    .then(() => {})
    .catch(() => {});

  return {
    allowed: true,
    remaining: limit - currentCount - 1,
    retryAfterSeconds: 0,
  };
}
