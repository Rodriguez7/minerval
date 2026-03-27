-- Rate limit attempts — persistent, multi-instance-safe replacement for the
-- in-memory rate limiter. Each row records one attempt for a given key.
-- The application counts rows within the sliding window and prunes stale ones.

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_key_created
  ON rate_limit_attempts (key, created_at);
