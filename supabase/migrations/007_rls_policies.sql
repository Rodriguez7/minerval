-- minerval/supabase/migrations/007_rls_policies.sql

-- ── Helper: is the calling user an active member of this school? ────────────
-- Used in policies below to avoid repetition.
CREATE OR REPLACE FUNCTION is_school_member(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_memberships
    WHERE school_id = p_school_id
      AND user_id   = auth.uid()
      AND status    = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_school_member_with_role(p_school_id UUID, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_memberships
    WHERE school_id = p_school_id
      AND user_id   = auth.uid()
      AND status    = 'active'
      AND role      = ANY(p_roles)
  );
$$;

-- ── schools ────────────────────────────────────────────────────────────────
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_school" ON schools
  FOR SELECT USING (is_school_member(id));

CREATE POLICY "owners_update_school" ON schools
  FOR UPDATE
  USING (is_school_member_with_role(id, ARRAY['owner','admin']))
  WITH CHECK (is_school_member_with_role(id, ARRAY['owner','admin']));

-- ── students ───────────────────────────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_students" ON students
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "members_insert_students" ON students
  FOR INSERT WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

CREATE POLICY "members_update_students" ON students
  FOR UPDATE
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

CREATE POLICY "members_delete_students" ON students
  FOR DELETE USING (is_school_member_with_role(school_id, ARRAY['owner','admin']));

-- ── fees ───────────────────────────────────────────────────────────────────
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_fees" ON fees
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "members_insert_fees" ON fees
  FOR INSERT WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

CREATE POLICY "members_update_fees" ON fees
  FOR UPDATE
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

-- Fee deletion is intentionally blocked via RLS.
-- Fees should be deactivated (active=false) rather than deleted.
-- No DELETE policy is provided.

-- ── payment_requests ───────────────────────────────────────────────────────
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_payments" ON payment_requests
  FOR SELECT USING (is_school_member(school_id));

CREATE POLICY "members_update_payments" ON payment_requests
  FOR UPDATE
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin','finance']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin','finance']));

-- Public insert is handled by service-role (payment initiation API).
-- No INSERT policy needed for dashboard users.

-- ── payment_events ─────────────────────────────────────────────────────────
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_payment_events" ON payment_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM payment_requests pr
      WHERE pr.id = payment_events.payment_request_id
        AND is_school_member(pr.school_id)
    )
  );

-- Inserts go through service-role only.

-- ── school_memberships ─────────────────────────────────────────────────────
ALTER TABLE school_memberships ENABLE ROW LEVEL SECURITY;

-- A user sees memberships for schools they belong to
CREATE POLICY "members_select_memberships" ON school_memberships
  FOR SELECT USING (is_school_member(school_id));

-- Owners/admins manage memberships (invite, deactivate)
CREATE POLICY "owners_insert_memberships" ON school_memberships
  FOR INSERT WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

CREATE POLICY "owners_update_memberships" ON school_memberships
  FOR UPDATE
  USING (is_school_member_with_role(school_id, ARRAY['owner','admin']))
  WITH CHECK (is_school_member_with_role(school_id, ARRAY['owner','admin']));

-- Membership deletion is intentionally blocked via RLS.
-- Members should be deactivated (status='inactive') rather than deleted.
-- No DELETE policy is provided.

-- ── school_subscriptions ───────────────────────────────────────────────────
ALTER TABLE school_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_subscription" ON school_subscriptions
  FOR SELECT USING (is_school_member(school_id));

-- Writes to school_subscriptions go through service-role (Stripe webhooks).

-- ── billing_events ─────────────────────────────────────────────────────────
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_select_billing_events" ON billing_events
  FOR SELECT USING (is_school_member_with_role(school_id, ARRAY['owner','admin']));

-- Writes go through service-role (Stripe webhooks).

-- ── school_pricing_policies ────────────────────────────────────────────────
ALTER TABLE school_pricing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_pricing_policy" ON school_pricing_policies
  FOR SELECT USING (is_school_member(school_id));

-- Writes go through service-role for now.

-- ── plans (public read) ────────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Plans table is public read (needed for billing page, plan comparison)
CREATE POLICY "public_select_active_plans" ON plans
  FOR SELECT USING (active = true);
