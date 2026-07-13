-- Model the institution levels used by the Congolese education system.
-- Existing schools keep broad non-university coverage until an owner refines it.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS education_levels TEXT[] NOT NULL
    DEFAULT ARRAY['preschool', 'primary', 'secondary']::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schools_education_levels_check'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_education_levels_check
      CHECK (
        cardinality(education_levels) > 0
        AND education_levels <@ ARRAY[
          'preschool', 'primary', 'secondary', 'university'
        ]::TEXT[]
      );
  END IF;
END$$;
