-- Extend schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_code_unique'
  ) THEN
    ALTER TABLE schools ADD CONSTRAINT schools_code_unique UNIQUE (code);
  END IF;
END$$;

-- Rename students.name → full_name, add class_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'name'
  ) THEN
    ALTER TABLE students RENAME COLUMN name TO full_name;
  END IF;
END$$;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_school_id_external_id_key'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_school_id_external_id_key UNIQUE (school_id, external_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_amount_due_nonneg'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_amount_due_nonneg CHECK (amount_due >= 0);
  END IF;
END$$;

-- Fees table
CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recurring','special')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- updated_at on payment_requests
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Payment events audit log
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_student_id ON payment_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_school_id ON payment_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_request_id ON payment_events(payment_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_serdipay_ref
  ON payment_requests(serdipay_ref) WHERE serdipay_ref IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
