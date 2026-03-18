-- Add student ID prefix and atomic counter to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS student_id_prefix TEXT NOT NULL DEFAULT 'STU',
  ADD COLUMN IF NOT EXISTS student_id_seq    INTEGER NOT NULL DEFAULT 0;

-- Seed counter = current student count per school (so next auto-generated ID is correct)
UPDATE schools s
SET student_id_seq = (SELECT COUNT(*) FROM students WHERE school_id = s.id);

-- Atomic increment RPC (race-condition safe for concurrent inserts)
CREATE OR REPLACE FUNCTION increment_student_seq(p_school_id UUID, p_count INTEGER DEFAULT 1)
RETURNS TABLE(prefix TEXT, new_seq INTEGER) LANGUAGE sql AS $$
  UPDATE schools
  SET student_id_seq = student_id_seq + p_count
  WHERE id = p_school_id
  RETURNING student_id_prefix, student_id_seq;
$$;
