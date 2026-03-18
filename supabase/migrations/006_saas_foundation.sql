-- minerval/supabase/migrations/006_saas_foundation.sql

-- ── 1. Extend schools ──────────────────────────────────────────────────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS billing_email    TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact  TEXT,
  ADD COLUMN IF NOT EXISTS timezone         TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS support_tier     TEXT NOT NULL DEFAULT 'standard';

-- ── 2. Plans ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  code                      TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  monthly_price_usd         NUMERIC(10,2) NOT NULL DEFAULT 0,
  active                    BOOLEAN NOT NULL DEFAULT true,
  -- entitlements (typed columns, not JSON)
  can_branded_receipts      BOOLEAN NOT NULL DEFAULT false,
  can_rich_reports          BOOLEAN NOT NULL DEFAULT false,
  can_bulk_ops              BOOLEAN NOT NULL DEFAULT false,
  can_accounting_export     BOOLEAN NOT NULL DEFAULT false,
  can_advanced_analytics    BOOLEAN NOT NULL DEFAULT false,
  max_students              INT,        -- NULL = unlimited
  future_payout_discount_bps INT NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT now()
);

INSERT INTO plans
  (code, name, monthly_price_usd, active,
   can_branded_receipts, can_rich_reports, can_bulk_ops,
   can_accounting_export, can_advanced_analytics,
   max_students, future_payout_discount_bps)
VALUES
  -- visible plans
  ('starter_free',       'Starter', 0,  true,  false, false, false, false, false, NULL, 0),
  ('growth_monthly',     'Growth',  29, true,  true,  true,  false, false, false, NULL, 0),
  ('pro_monthly',        'Pro',     99, true,  true,  true,  true,  true,  true,  NULL, 50),
  -- hidden legacy plan (billing_exempt schools only)
  ('legacy_grandfathered','Legacy (Grandfathered)', 0, false, false, false, false, false, false, NULL, 0)
ON CONFLICT (code) DO NOTHING;

-- ── 3. School memberships ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','finance','viewer')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_school_memberships_user_id  ON school_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_school_id ON school_memberships(school_id);
CREATE INDEX IF NOT EXISTS idx_school_memberships_user_school_status
  ON school_memberships(user_id, school_id, status);

-- ── 4. School subscriptions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_code              TEXT NOT NULL REFERENCES plans(code),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','trialing','past_due','canceled')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_end     TIMESTAMPTZ,
  trial_ends_at          TIMESTAMPTZ,
  billing_exempt         BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id)
);

DROP TRIGGER IF EXISTS trg_school_subscriptions_updated_at ON school_subscriptions;
CREATE TRIGGER trg_school_subscriptions_updated_at
  BEFORE UPDATE ON school_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Billing events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  stripe_event_id TEXT UNIQUE,   -- idempotency key; NULL for internal events
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'stripe.subscription.created',
    'stripe.subscription.updated',
    'stripe.subscription.deleted',
    'stripe.invoice.paid',
    'stripe.invoice.payment_failed',
    'subscription.plan_changed',
    'subscription.billing_exempt_set'
  )),
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_school_id ON billing_events(school_id);

-- ── 6. School pricing policies ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_pricing_policies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_fee_bps   INT NOT NULL DEFAULT 275,
  fee_display_mode TEXT NOT NULL DEFAULT 'visible_line_item'
                     CHECK (fee_display_mode IN ('visible_line_item','hidden')),
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id)
);

DROP TRIGGER IF EXISTS trg_school_pricing_policies_updated_at ON school_pricing_policies;
CREATE TRIGGER trg_school_pricing_policies_updated_at
  BEFORE UPDATE ON school_pricing_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 7. Backfill existing schools ───────────────────────────────────────────
-- Create owner memberships from current admin_email
INSERT INTO school_memberships (user_id, school_id, role, status)
SELECT au.id, s.id, 'owner', 'active'
FROM   schools s
JOIN   auth.users au ON au.email = s.admin_email
ON CONFLICT (user_id, school_id) DO NOTHING;

-- Grandfathered free subscription for every existing school
INSERT INTO school_subscriptions (school_id, plan_code, status, billing_exempt)
SELECT id, 'legacy_grandfathered', 'active', true
FROM   schools
ON CONFLICT (school_id) DO NOTHING;

-- Default pricing policy for every existing school
INSERT INTO school_pricing_policies (school_id, parent_fee_bps, fee_display_mode, active)
SELECT id, 275, 'visible_line_item', true
FROM   schools
ON CONFLICT (school_id) DO NOTHING;
