-- minerval/supabase/migrations/027_revoke_function_access_from_api_roles.sql
--
-- Earlier migrations ran `REVOKE ALL ON FUNCTION ... FROM PUBLIC`, but Supabase
-- also grants EXECUTE on every new function directly to the `anon` and
-- `authenticated` roles (default privileges). Revoking from PUBLIC leaves those
-- direct grants in place, so anyone holding the public anon key could call
-- SECURITY DEFINER functions through the Data API (/rest/v1/rpc/...), e.g.
-- claim_whatsapp_messages, which returns queued messages with guardian data.
--
-- The app calls these functions only with the service-role client or as a
-- signed-in user, so this changes no application behaviour.

DO $$
DECLARE
  fn regprocedure;
BEGIN
  -- Server-only: called with the service-role key, or fired as triggers.
  -- (Postgres checks EXECUTE on trigger functions only when the trigger is created.)
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'consume_rate_limit',
        'cleanup_rate_limit_attempts',
        'claim_whatsapp_messages',
        'cancel_student_whatsapp_messages',
        'replace_student_balance_cycle',
        'cancel_whatsapp_for_closed_school',
        'create_default_school_whatsapp_settings',
        'set_updated_at'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', fn);
  END LOOP;

  -- Signed-in school staff call these (each checks membership internally);
  -- the public anon role never needs them.
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'create_student_with_guardian',
        'import_students_with_guardians',
        'set_student_primary_guardian',
        'request_school_payout',
        'close_school'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
  END LOOP;
END $$;

-- is_school_member / is_school_member_with_role stay callable: RLS policies
-- evaluate them as the querying role, and they only report the caller's own
-- membership.

-- Future functions: no automatic EXECUTE for the API roles. Migrations must
-- GRANT explicitly (as this codebase already does for `authenticated`).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
