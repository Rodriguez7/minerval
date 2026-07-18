-- Automatic guardian WhatsApp reminders through Meta Cloud API.
-- Existing unpaid students are assigned a balance cycle but remain ineligible
-- until a school supplies a guardian and balance_due_at.

CREATE TABLE guardians (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name                TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 200),
  whatsapp_phone           TEXT NOT NULL CHECK (whatsapp_phone ~ '^243[89][0-9]{8}$'),
  preferred_locale         TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_locale = 'fr'),
  whatsapp_opt_in_at       TIMESTAMPTZ NOT NULL,
  whatsapp_opt_in_source   TEXT NOT NULL CHECK (
    whatsapp_opt_in_source IN ('manual_entry', 'csv_import', 'parent_form')
  ),
  whatsapp_opted_out_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, whatsapp_phone)
);

CREATE INDEX idx_guardians_school_id ON guardians(school_id);

DROP TRIGGER IF EXISTS trg_guardians_updated_at ON guardians;
CREATE TRIGGER trg_guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE student_guardians (
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id   UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship  TEXT NOT NULL CHECK (relationship IN ('parent', 'guardian', 'payer')),
  is_primary    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, guardian_id)
);

CREATE UNIQUE INDEX idx_student_guardians_one_primary
  ON student_guardians(student_id) WHERE is_primary;
CREATE INDEX idx_student_guardians_guardian_id ON student_guardians(guardian_id);

ALTER TABLE students
  ADD COLUMN balance_due_at TIMESTAMPTZ,
  ADD COLUMN reminder_cycle_id UUID,
  ADD COLUMN reminders_paused_until TIMESTAMPTZ,
  ADD COLUMN reminder_stop_reason TEXT;

UPDATE students
SET reminder_cycle_id = gen_random_uuid()
WHERE amount_due > 0 AND reminder_cycle_id IS NULL;

CREATE INDEX idx_students_reminder_eligibility
  ON students(school_id, balance_due_at)
  WHERE amount_due > 0 AND balance_due_at IS NOT NULL;

CREATE TABLE student_payment_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reminder_cycle_id   UUID NOT NULL,
  token_hash          TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_payment_links_student_cycle
  ON student_payment_links(student_id, reminder_cycle_id);

CREATE TABLE school_whatsapp_settings (
  school_id                     UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  automatic_reminders_enabled   BOOLEAN NOT NULL DEFAULT true,
  local_send_hour               SMALLINT NOT NULL DEFAULT 9 CHECK (local_send_hour BETWEEN 0 AND 23),
  max_reminders                 SMALLINT NOT NULL DEFAULT 6 CHECK (max_reminders BETWEEN 1 AND 6),
  paused_until                  TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO school_whatsapp_settings (school_id)
SELECT id FROM schools
ON CONFLICT (school_id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_school_whatsapp_settings_updated_at ON school_whatsapp_settings;
CREATE TRIGGER trg_school_whatsapp_settings_updated_at
  BEFORE UPDATE ON school_whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION create_default_school_whatsapp_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO school_whatsapp_settings (school_id) VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_default_whatsapp_settings ON schools;
CREATE TRIGGER trg_schools_default_whatsapp_settings
  AFTER INSERT ON schools
  FOR EACH ROW EXECUTE FUNCTION create_default_school_whatsapp_settings();

CREATE TABLE whatsapp_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id         UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  reminder_cycle_id   UUID NOT NULL,
  kind                TEXT NOT NULL CHECK (
    kind IN ('payment_reminder', 'payment_confirmed', 'payment_failed')
  ),
  stage               SMALLINT CHECK (stage BETWEEN 0 AND 5),
  template_name       TEXT NOT NULL,
  locale              TEXT NOT NULL CHECK (locale = 'fr'),
  scheduled_for       TIMESTAMPTZ NOT NULL,
  amount_snapshot     NUMERIC(12,2) NOT NULL CHECK (amount_snapshot >= 0),
  currency            TEXT NOT NULL,
  payment_link_id     UUID REFERENCES student_payment_links(id) ON DELETE SET NULL,
  receipt_access_token TEXT,
  status              TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'cancelled')
  ),
  meta_message_id     TEXT UNIQUE,
  attempt_count       SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  error_code          TEXT,
  error_message       TEXT,
  accepted_at         TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'payment_reminder' AND stage IS NOT NULL) OR (kind <> 'payment_reminder' AND stage IS NULL))
);

CREATE UNIQUE INDEX idx_whatsapp_messages_unique_reminder_stage
  ON whatsapp_messages(student_id, reminder_cycle_id, kind, stage)
  WHERE kind = 'payment_reminder';
CREATE INDEX idx_whatsapp_messages_dispatch
  ON whatsapp_messages(status, scheduled_for)
  WHERE status IN ('queued', 'failed');
CREATE INDEX idx_whatsapp_messages_school_created
  ON whatsapp_messages(school_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION cancel_whatsapp_for_closed_school()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed' THEN
    UPDATE whatsapp_messages
    SET status = 'cancelled',
        cancelled_at = clock_timestamp(),
        cancel_reason = 'school_closed'
    WHERE school_id = NEW.id AND status IN ('queued', 'sending', 'failed');

    UPDATE student_payment_links
    SET revoked_at = COALESCE(revoked_at, clock_timestamp())
    WHERE school_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_cancel_whatsapp_on_close ON schools;
CREATE TRIGGER trg_schools_cancel_whatsapp_on_close
  AFTER UPDATE OF status ON schools
  FOR EACH ROW EXECUTE FUNCTION cancel_whatsapp_for_closed_school();

-- RLS ---------------------------------------------------------------------

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardians_select ON guardians
  FOR SELECT USING (is_school_member(school_id));
CREATE POLICY guardians_write ON guardians
  FOR ALL
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin','finance']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin','finance']));

CREATE POLICY student_guardians_select ON student_guardians
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_guardians.student_id AND is_school_member(s.school_id)
    )
  );
CREATE POLICY student_guardians_write ON student_guardians
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_guardians.student_id
        AND is_school_member_with_role(s.school_id, ARRAY['owner','admin','finance'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = student_guardians.student_id
        AND is_school_member_with_role(s.school_id, ARRAY['owner','admin','finance'])
    )
  );

CREATE POLICY student_payment_links_select ON student_payment_links
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY school_whatsapp_settings_select ON school_whatsapp_settings
  FOR SELECT USING (is_school_member(school_id));
CREATE POLICY school_whatsapp_settings_update ON school_whatsapp_settings
  FOR UPDATE
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

CREATE POLICY whatsapp_messages_select ON whatsapp_messages
  FOR SELECT USING (is_school_member(school_id));

-- Atomic student/guardian creation ----------------------------------------

CREATE OR REPLACE FUNCTION create_student_with_guardian(
  p_school_id UUID,
  p_full_name TEXT,
  p_class_name TEXT,
  p_amount_due NUMERIC,
  p_balance_due_at TIMESTAMPTZ,
  p_guardian_name TEXT,
  p_guardian_phone TEXT,
  p_guardian_relationship TEXT,
  p_guardian_locale TEXT,
  p_opt_in_source TEXT DEFAULT 'manual_entry'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian_id UUID;
  v_student_id UUID;
  v_prefix TEXT;
  v_sequence INTEGER;
  v_external_id TEXT;
  v_cycle_id UUID;
  v_opted_out_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR NOT is_school_member_with_role(
    p_school_id,
    ARRAY['owner','admin','finance']
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF length(trim(COALESCE(p_full_name, ''))) NOT BETWEEN 1 AND 200
    OR length(trim(COALESCE(p_guardian_name, ''))) NOT BETWEEN 1 AND 200
    OR p_guardian_phone !~ '^243[89][0-9]{8}$'
    OR p_guardian_relationship NOT IN ('parent', 'guardian', 'payer')
    OR p_guardian_locale IS DISTINCT FROM 'fr'
    OR p_opt_in_source NOT IN ('manual_entry', 'csv_import', 'parent_form')
    OR p_amount_due < 0
    OR (p_amount_due > 0 AND p_balance_due_at IS NULL)
  THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::TEXT, 0));

  UPDATE schools
  SET student_id_seq = student_id_seq + 1
  WHERE id = p_school_id AND status = 'active'
  RETURNING student_id_prefix, student_id_seq INTO v_prefix, v_sequence;

  IF v_sequence IS NULL THEN
    RETURN jsonb_build_object('error', 'school_not_found_or_inactive');
  END IF;

  v_external_id := v_prefix || '-' || lpad(v_sequence::TEXT, 3, '0');
  v_cycle_id := CASE WHEN p_amount_due > 0 THEN gen_random_uuid() ELSE NULL END;

  INSERT INTO guardians (
    school_id,
    full_name,
    whatsapp_phone,
    preferred_locale,
    whatsapp_opt_in_at,
    whatsapp_opt_in_source
  )
  VALUES (
    p_school_id,
    trim(p_guardian_name),
    p_guardian_phone,
    p_guardian_locale,
    clock_timestamp(),
    p_opt_in_source
  )
  ON CONFLICT (school_id, whatsapp_phone) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      preferred_locale = EXCLUDED.preferred_locale
  RETURNING id, whatsapp_opted_out_at INTO v_guardian_id, v_opted_out_at;

  IF v_opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'guardian_whatsapp_opted_out';
  END IF;

  INSERT INTO students (
    school_id,
    external_id,
    full_name,
    class_name,
    amount_due,
    balance_due_at,
    reminder_cycle_id
  )
  VALUES (
    p_school_id,
    v_external_id,
    trim(p_full_name),
    NULLIF(trim(COALESCE(p_class_name, '')), ''),
    p_amount_due,
    CASE WHEN p_amount_due > 0 THEN p_balance_due_at ELSE NULL END,
    v_cycle_id
  )
  RETURNING id INTO v_student_id;

  INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
  VALUES (v_student_id, v_guardian_id, p_guardian_relationship, true);

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'external_id', v_external_id,
    'guardian_id', v_guardian_id,
    'reminder_cycle_id', v_cycle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION create_student_with_guardian(
  UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_student_with_guardian(
  UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION import_students_with_guardians(
  p_school_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_result JSONB;
  v_imported INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT is_school_member_with_role(
    p_school_id,
    ARRAY['owner','admin','finance']
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF jsonb_typeof(p_rows) <> 'array'
    OR jsonb_array_length(p_rows) < 1
    OR jsonb_array_length(p_rows) > 1000
  THEN
    RETURN jsonb_build_object('error', 'invalid_rows');
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_result := create_student_with_guardian(
      p_school_id,
      v_row->>'full_name',
      COALESCE(v_row->>'class_name', ''),
      (v_row->>'amount_due')::NUMERIC,
      NULLIF(v_row->>'balance_due_at', '')::TIMESTAMPTZ,
      v_row->>'guardian_name',
      v_row->>'guardian_phone',
      v_row->>'guardian_relationship',
      v_row->>'guardian_locale',
      'csv_import'
    );

    IF v_result ? 'error' THEN
      RAISE EXCEPTION 'student import row % failed: %', v_imported + 1, v_result->>'error';
    END IF;

    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object('imported', v_imported);
END;
$$;

REVOKE ALL ON FUNCTION import_students_with_guardians(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_students_with_guardians(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION set_student_primary_guardian(
  p_school_id UUID,
  p_student_id UUID,
  p_guardian_name TEXT,
  p_guardian_phone TEXT,
  p_guardian_relationship TEXT,
  p_guardian_locale TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian_id UUID;
  v_opted_out_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR NOT is_school_member_with_role(
    p_school_id,
    ARRAY['owner','admin','finance']
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND school_id = p_school_id)
    OR length(trim(COALESCE(p_guardian_name, ''))) NOT BETWEEN 1 AND 200
    OR COALESCE(p_guardian_phone, '') !~ '^243[89][0-9]{8}$'
    OR p_guardian_relationship NOT IN ('parent', 'guardian', 'payer')
    OR p_guardian_locale IS DISTINCT FROM 'fr'
  THEN
    RETURN jsonb_build_object('error', 'invalid_input');
  END IF;

  INSERT INTO guardians (
    school_id, full_name, whatsapp_phone, preferred_locale,
    whatsapp_opt_in_at, whatsapp_opt_in_source
  ) VALUES (
    p_school_id, trim(p_guardian_name), p_guardian_phone, p_guardian_locale,
    clock_timestamp(), 'manual_entry'
  )
  ON CONFLICT (school_id, whatsapp_phone) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      preferred_locale = EXCLUDED.preferred_locale
  RETURNING id, whatsapp_opted_out_at INTO v_guardian_id, v_opted_out_at;

  IF v_opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'guardian_whatsapp_opted_out';
  END IF;

  DELETE FROM student_guardians WHERE student_id = p_student_id AND is_primary;
  INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
  VALUES (p_student_id, v_guardian_id, p_guardian_relationship, true);

  RETURN jsonb_build_object('guardian_id', v_guardian_id);
END;
$$;

REVOKE ALL ON FUNCTION set_student_primary_guardian(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_student_primary_guardian(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Atomic service-role helpers ---------------------------------------------

CREATE OR REPLACE FUNCTION claim_whatsapp_messages(p_limit INTEGER DEFAULT 50)
RETURNS SETOF whatsapp_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid WhatsApp claim limit';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM whatsapp_messages
    WHERE scheduled_for <= clock_timestamp()
      AND (
        status = 'queued'
        OR (status = 'failed' AND attempt_count < 3)
      )
    ORDER BY scheduled_for, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE whatsapp_messages wm
  SET status = 'sending',
      attempt_count = wm.attempt_count + 1,
      error_code = NULL,
      error_message = NULL,
      updated_at = clock_timestamp()
  FROM candidates
  WHERE wm.id = candidates.id
  RETURNING wm.*;
END;
$$;

REVOKE ALL ON FUNCTION claim_whatsapp_messages(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_whatsapp_messages(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION cancel_student_whatsapp_messages(
  p_student_id UUID,
  p_reminder_cycle_id UUID,
  p_reason TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled INTEGER;
BEGIN
  UPDATE whatsapp_messages
  SET status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancel_reason = left(COALESCE(NULLIF(trim(p_reason), ''), 'cancelled'), 200)
  WHERE student_id = p_student_id
    AND reminder_cycle_id = p_reminder_cycle_id
    AND status IN ('queued', 'sending', 'failed');

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE student_payment_links
  SET revoked_at = COALESCE(revoked_at, clock_timestamp())
  WHERE student_id = p_student_id
    AND reminder_cycle_id = p_reminder_cycle_id
    AND revoked_at IS NULL;

  RETURN v_cancelled;
END;
$$;

REVOKE ALL ON FUNCTION cancel_student_whatsapp_messages(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_student_whatsapp_messages(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION replace_student_balance_cycle(
  p_school_id UUID,
  p_external_id TEXT,
  p_amount_due NUMERIC,
  p_balance_due_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_old_cycle UUID;
BEGIN
  IF p_amount_due < 0 OR (p_amount_due > 0 AND p_balance_due_at IS NULL) THEN
    RAISE EXCEPTION 'invalid student balance';
  END IF;

  SELECT id, reminder_cycle_id
  INTO v_student_id, v_old_cycle
  FROM students
  WHERE school_id = p_school_id AND external_id = p_external_id
  FOR UPDATE;

  IF v_student_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_old_cycle IS NOT NULL THEN
    PERFORM cancel_student_whatsapp_messages(v_student_id, v_old_cycle, 'balance_replaced');
  END IF;

  UPDATE students
  SET amount_due = p_amount_due,
      balance_due_at = CASE WHEN p_amount_due > 0 THEN p_balance_due_at ELSE NULL END,
      reminder_cycle_id = CASE WHEN p_amount_due > 0 THEN gen_random_uuid() ELSE NULL END,
      reminders_paused_until = NULL,
      reminder_stop_reason = NULL
  WHERE id = v_student_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION replace_student_balance_cycle(UUID, TEXT, NUMERIC, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_student_balance_cycle(UUID, TEXT, NUMERIC, TIMESTAMPTZ) TO service_role;
