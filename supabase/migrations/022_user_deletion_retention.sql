-- Allow a verified personal-account deletion without erasing financial or
-- invitation audit records. The historical action remains; only the deleted
-- Supabase identity reference is removed.

ALTER TABLE school_payouts
  ALTER COLUMN requested_by DROP NOT NULL;

ALTER TABLE school_payouts
  DROP CONSTRAINT IF EXISTS school_payouts_requested_by_fkey;

ALTER TABLE school_payouts
  ADD CONSTRAINT school_payouts_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE school_invites
  ALTER COLUMN invited_by DROP NOT NULL;

ALTER TABLE school_invites
  DROP CONSTRAINT IF EXISTS school_invites_invited_by_fkey;

ALTER TABLE school_invites
  ADD CONSTRAINT school_invites_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN school_payouts.requested_by IS
  'Requesting user when retained; null after that user deletes their account.';

COMMENT ON COLUMN school_invites.invited_by IS
  'Inviting user when retained; null after that user deletes their account.';
