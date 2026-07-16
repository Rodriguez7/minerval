-- minerval/supabase/migrations/024_rls_hardening.sql
--
-- Closes the two remaining tables without row level security.
-- All application reads and writes on these tables go through the
-- service-role client (bypasses RLS), so no app change is required.

-- ── school_invites ───────────────────────────────────────────────────────────
-- Stores invite emails and bearer tokens. Without RLS, any holder of the
-- public anon key can read every invite token via the Data API and join
-- any school with the invited role.
ALTER TABLE school_invites ENABLE ROW LEVEL SECURITY;

-- Owners/admins may list their own school's invites (future dashboard use).
CREATE POLICY "owners_select_invites" ON school_invites
  FOR SELECT
  TO authenticated
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin']));

-- Invite creation, acceptance and revocation all run through the
-- service-role client. No INSERT/UPDATE/DELETE policies on purpose.

-- The token column is a bearer credential: never expose it through the
-- Data API, even to members of the school that created it.
REVOKE ALL ON school_invites FROM anon, authenticated;
GRANT SELECT (id, school_id, email, role, invited_by, accepted_at, expires_at, created_at)
  ON school_invites TO authenticated;

-- ── rate_limit_attempts ──────────────────────────────────────────────────────
-- Internal bookkeeping written only by the service role. Without RLS an
-- attacker can delete rows through the Data API to defeat rate limiting.
ALTER TABLE rate_limit_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limit_attempts FROM anon, authenticated;
-- No policies: deny-all for API roles; the service role bypasses RLS.

-- The existing membership helpers intentionally retain their current EXECUTE
-- grants. Public plan reads have a second membership-based SELECT policy, and
-- revoking helper execution from PUBLIC could make anonymous plan queries fail
-- during policy evaluation. Both helpers are caller-scoped through auth.uid().
