-- minerval/supabase/migrations/008_school_invites.sql

CREATE TABLE IF NOT EXISTS school_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','finance','viewer')),
  token       TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_invites_token     ON school_invites(token);
CREATE INDEX IF NOT EXISTS idx_school_invites_school_id ON school_invites(school_id);
