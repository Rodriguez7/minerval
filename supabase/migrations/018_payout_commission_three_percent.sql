-- Retain a 3% Minerval commission from each new school payout request.
-- Existing payout rows keep their original economics and are not charged retroactively.

ALTER TABLE school_payouts
  ADD COLUMN IF NOT EXISTS fee_bps INT,
  ADD COLUMN IF NOT EXISTS fee_amount INT,
  ADD COLUMN IF NOT EXISTS net_amount INT;

UPDATE school_payouts
SET fee_bps = 0,
    fee_amount = 0,
    net_amount = amount
WHERE fee_bps IS NULL OR fee_amount IS NULL OR net_amount IS NULL;

ALTER TABLE school_payouts
  ALTER COLUMN fee_bps SET DEFAULT 300,
  ALTER COLUMN fee_bps SET NOT NULL,
  ALTER COLUMN fee_amount SET NOT NULL,
  ALTER COLUMN net_amount SET NOT NULL;

ALTER TABLE school_payouts
  ADD CONSTRAINT school_payouts_fee_bps_range
    CHECK (fee_bps BETWEEN 0 AND 10000),
  ADD CONSTRAINT school_payouts_fee_amount_valid
    CHECK (fee_amount >= 0 AND fee_amount <= amount),
  ADD CONSTRAINT school_payouts_net_amount_valid
    CHECK (net_amount > 0 AND net_amount = amount - fee_amount);

CREATE OR REPLACE FUNCTION request_school_payout(
  p_school_id UUID,
  p_requested_by UUID,
  p_amount INT,
  p_phone TEXT,
  p_telecom TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available BIGINT;
  v_payout_id UUID;
  v_fee_bps INT := 300;
  v_fee_amount INT;
  v_net_amount INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_requested_by THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM school_memberships sm
    JOIN schools s ON s.id = sm.school_id
    WHERE sm.school_id = p_school_id
      AND sm.user_id = auth.uid()
      AND sm.role = 'owner'
      AND sm.status = 'active'
      AND s.verification_status = 'verified'
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  -- 1,031 less the rounded 3% fee is exactly SerdiPay's 1,000-unit minimum.
  IF p_amount < 1031 THEN
    RETURN jsonb_build_object('error', 'below_minimum');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_school_id::text));

  -- Every non-failed payout permanently reserves its requested gross amount.
  -- Completed payouts must remain deducted or they become withdrawable again.
  SELECT
    COALESCE(SUM(pr.amount - COALESCE(pr.fee_amount, 0)), 0)
    - COALESCE((
        SELECT SUM(sp.amount)
        FROM school_payouts sp
        WHERE sp.school_id = p_school_id AND sp.status <> 'failed'
      ), 0)
  INTO v_available
  FROM payment_requests pr
  WHERE pr.school_id = p_school_id AND pr.status = 'success';

  IF p_amount > v_available THEN
    RETURN jsonb_build_object('error', 'insufficient_balance', 'available', v_available);
  END IF;

  v_fee_amount := ROUND((p_amount::NUMERIC * v_fee_bps) / 10000)::INT;
  v_net_amount := p_amount - v_fee_amount;

  INSERT INTO school_payouts (
    school_id, requested_by, amount, fee_bps, fee_amount, net_amount, phone, telecom
  ) VALUES (
    p_school_id, p_requested_by, p_amount, v_fee_bps, v_fee_amount, v_net_amount, p_phone, p_telecom
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'id', v_payout_id,
    'status', 'pending',
    'amount', p_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION request_school_payout(UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_school_payout(UUID, UUID, INT, TEXT, TEXT) TO authenticated;
