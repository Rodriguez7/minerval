-- Internal school-verification review history and international WhatsApp recipients.

CREATE TABLE IF NOT EXISTS school_verification_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision    TEXT NOT NULL CHECK (decision IN ('verified', 'rejected')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_verification_reviews_school_created
  ON school_verification_reviews(school_id, created_at DESC);

ALTER TABLE school_verification_reviews ENABLE ROW LEVEL SECURITY;

-- Verification reviews are an internal service-role surface. School users read
-- their current status from schools, but never reviewer identities or notes.
REVOKE ALL ON TABLE school_verification_reviews FROM anon, authenticated;

-- Meta Cloud API accepts E.164 destinations internationally. Keep the stored
-- representation as digits without a leading plus sign.
ALTER TABLE guardians
  DROP CONSTRAINT IF EXISTS guardians_whatsapp_phone_check;

ALTER TABLE guardians
  ADD CONSTRAINT guardians_whatsapp_phone_check
  CHECK (whatsapp_phone ~ '^[1-9][0-9]{7,14}$');

-- Keep the two SECURITY DEFINER write paths aligned with the table constraint.
-- This preserves their existing authorization and atomic-write behavior while
-- allowing any valid international E.164 WhatsApp recipient.
DO $$
DECLARE
  v_definition TEXT;
  v_updated TEXT;
BEGIN
  SELECT pg_get_functiondef(oid)
  INTO v_definition
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'create_student_with_guardian'
  LIMIT 1;

  v_updated := replace(
    v_definition,
    'p_guardian_phone !~ ''^243[89][0-9]{8}$''',
    'p_guardian_phone !~ ''^[1-9][0-9]{7,14}$'''
  );
  IF v_definition IS NULL OR v_updated = v_definition THEN
    RAISE EXCEPTION 'create_student_with_guardian phone validation was not updated';
  END IF;
  EXECUTE v_updated;

  SELECT pg_get_functiondef(oid)
  INTO v_definition
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace
    AND proname = 'set_student_primary_guardian'
  LIMIT 1;

  v_updated := replace(
    v_definition,
    'COALESCE(p_guardian_phone, '''') !~ ''^243[89][0-9]{8}$''',
    'COALESCE(p_guardian_phone, '''') !~ ''^[1-9][0-9]{7,14}$'''
  );
  IF v_definition IS NULL OR v_updated = v_definition THEN
    RAISE EXCEPTION 'set_student_primary_guardian phone validation was not updated';
  END IF;
  EXECUTE v_updated;
END;
$$;
