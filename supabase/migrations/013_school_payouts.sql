-- supabase/migrations/013_school_payouts.sql

CREATE TABLE school_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  amount INT NOT NULL CHECK (amount > 0),
  phone TEXT NOT NULL,
  telecom TEXT NOT NULL CHECK (telecom IN ('AM', 'OM', 'MP', 'AF')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  serdipay_ref TEXT,
  serdipay_transaction_id TEXT,
  failure_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_payouts_school_id ON school_payouts(school_id);
CREATE INDEX IF NOT EXISTS idx_school_payouts_status ON school_payouts(school_id, status, created_at DESC);

-- RLS
ALTER TABLE school_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_members_read_payouts" ON school_payouts
  FOR SELECT USING (is_school_member(school_id));

-- Atomic payout request function: advisory lock + balance check + insert in one transaction
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
BEGIN
  -- Auth guard: caller must be authenticated and match the requested_by param
  IF auth.uid() IS NULL OR auth.uid() != p_requested_by THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Advisory lock scoped to this school (prevents concurrent double-requests)
  PERFORM pg_advisory_xact_lock(hashtext(p_school_id::text));

  -- Calculate available balance: collected minus in-flight payouts
  SELECT
    COALESCE(SUM(pr.amount - COALESCE(pr.fee_amount, 0)), 0)
    - COALESCE((
        SELECT SUM(sp.amount)
        FROM school_payouts sp
        WHERE sp.school_id = p_school_id AND sp.status IN ('pending', 'processing')
      ), 0)
  INTO v_available
  FROM payment_requests pr
  WHERE pr.school_id = p_school_id AND pr.status = 'success';

  IF p_amount > v_available THEN
    RETURN jsonb_build_object('error', 'insufficient_balance', 'available', v_available);
  END IF;

  INSERT INTO school_payouts (school_id, requested_by, amount, phone, telecom)
  VALUES (p_school_id, p_requested_by, p_amount, p_phone, p_telecom)
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object('id', v_payout_id, 'status', 'pending');
END;
$$;

DROP TRIGGER IF EXISTS trg_school_payouts_updated_at ON school_payouts;
CREATE TRIGGER trg_school_payouts_updated_at
  BEFORE UPDATE ON school_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
