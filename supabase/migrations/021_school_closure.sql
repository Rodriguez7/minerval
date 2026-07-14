-- Reversible institution closure. Financial and audit records are retained;
-- public collection and member access are revoked atomically.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closure_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_status_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_status_check CHECK (status IN ('active', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

CREATE OR REPLACE FUNCTION close_school(
  p_school_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pending_payments INTEGER;
  v_pending_payouts INTEGER;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::TEXT, 0));

  SELECT status INTO v_status
  FROM schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM school_memberships
    WHERE school_id = p_school_id
      AND user_id = v_user_id
      AND role = 'owner'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF v_status = 'closed' THEN
    RETURN jsonb_build_object('closed', true, 'already_closed', true);
  END IF;

  SELECT count(*)::INTEGER INTO v_pending_payments
  FROM payment_requests
  WHERE school_id = p_school_id AND status = 'pending';

  SELECT count(*)::INTEGER INTO v_pending_payouts
  FROM school_payouts
  WHERE school_id = p_school_id AND status IN ('pending', 'processing');

  IF v_pending_payments > 0 OR v_pending_payouts > 0 THEN
    RETURN jsonb_build_object(
      'error', 'pending_financial_activity',
      'pending_payments', v_pending_payments,
      'pending_payouts', v_pending_payouts
    );
  END IF;

  UPDATE schools
  SET status = 'closed',
      closed_at = clock_timestamp(),
      closed_by = v_user_id,
      closure_reason = NULLIF(left(trim(COALESCE(p_reason, '')), 500), ''),
      payment_access_token = gen_random_uuid()::TEXT
  WHERE id = p_school_id;

  UPDATE school_memberships
  SET status = 'inactive'
  WHERE school_id = p_school_id AND status = 'active';

  DELETE FROM school_invites WHERE school_id = p_school_id;

  UPDATE school_subscriptions
  SET status = 'canceled', updated_at = clock_timestamp()
  WHERE school_id = p_school_id AND status <> 'canceled';

  RETURN jsonb_build_object('closed', true, 'already_closed', false);
END;
$$;

REVOKE ALL ON FUNCTION close_school(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_school(UUID, TEXT) TO authenticated;
