-- Add currency preference to schools (FC = Franc Congolais, USD = US Dollar)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'FC'
  CHECK (currency IN ('FC', 'USD'));
