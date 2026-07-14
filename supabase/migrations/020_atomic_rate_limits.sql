-- Serialize attempts for the same key inside Postgres so concurrent app
-- instances cannot all pass a count-then-insert race.

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_retry_after INTEGER;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 500 THEN
    RAISE EXCEPTION 'invalid rate-limit key';
  END IF;
  IF p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'invalid rate-limit limit';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit window';
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);

  -- Transaction-scoped and key-specific: no manual unlock is needed.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key, 0));

  SELECT count(*)::INTEGER, min(created_at)
    INTO v_count, v_oldest
  FROM rate_limit_attempts
  WHERE key = p_key
    AND created_at >= v_window_start;

  IF v_count >= p_limit THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM ((v_oldest + make_interval(secs => p_window_seconds)) - v_now)))::INTEGER
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  INSERT INTO rate_limit_attempts (key, created_at) VALUES (p_key, v_now);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_count - 1,
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION cleanup_rate_limit_attempts()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM rate_limit_attempts
  WHERE created_at < clock_timestamp() - INTERVAL '1 day';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_rate_limit_attempts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_attempts() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'minerval-rate-limit-cleanup',
  '17 * * * *',
  'SELECT public.cleanup_rate_limit_attempts()'
);
