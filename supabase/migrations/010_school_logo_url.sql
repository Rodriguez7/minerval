-- Add logo URL column to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
