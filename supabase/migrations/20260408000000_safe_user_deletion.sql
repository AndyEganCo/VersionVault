-- Make user deletion safe and atomic.
--
-- Two existing foreign keys to auth.users would block hard-deleting any admin
-- who has resolved an audit flag or sent a custom newsletter. Fix them so the
-- audit/log records survive when the user is deleted:
--
--   1. version_audit_flags.resolved_by  : default NO ACTION  -> ON DELETE SET NULL
--   2. newsletter_custom_sends.sent_by  : ON DELETE SET NULL but NOT NULL
--                                         (contradictory, always errors) -> drop NOT NULL
--
-- Also add a SECURITY DEFINER RPC that atomically protects against deleting
-- the last remaining admin under concurrent calls. The function takes an
-- EXCLUSIVE lock on admin_users, verifies that removing the target would not
-- leave the system without admins, and pre-removes the target's admin_users
-- row. The edge function then performs the actual auth.users deletion (the
-- subsequent cascade is a no-op for admin_users since the row is already gone).
-- This serializes concurrent calls and closes the TOCTOU window where two
-- admins could simultaneously delete each other.

-- 1. Fix version_audit_flags.resolved_by FK
ALTER TABLE version_audit_flags
  DROP CONSTRAINT IF EXISTS version_audit_flags_resolved_by_fkey;

ALTER TABLE version_audit_flags
  ADD CONSTRAINT version_audit_flags_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix newsletter_custom_sends.sent_by NOT NULL contradiction
ALTER TABLE newsletter_custom_sends
  ALTER COLUMN sent_by DROP NOT NULL;

-- 3. Atomic admin-protection RPC used by the delete-user edge function
CREATE OR REPLACE FUNCTION public.prepare_user_deletion(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_is_admin BOOLEAN;
  remaining_admin_count INTEGER;
BEGIN
  -- Serialize concurrent delete-user calls so two admins cannot simultaneously
  -- delete each other and leave the system with zero admins.
  LOCK TABLE admin_users IN EXCLUSIVE MODE;

  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = target_user_id
  ) INTO target_is_admin;

  IF target_is_admin THEN
    SELECT COUNT(*)::INTEGER
      FROM admin_users
      WHERE user_id <> target_user_id
      INTO remaining_admin_count;

    IF remaining_admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last remaining admin'
        USING ERRCODE = 'P0001';
    END IF;

    -- Remove the admin row inside the lock so the cascade from the auth.users
    -- delete is a no-op and the count check above is authoritative.
    DELETE FROM admin_users WHERE user_id = target_user_id;
  END IF;
END;
$$;

-- Only the service role should call this function (the edge function uses the
-- service role key). Revoke the default PUBLIC EXECUTE and grant explicitly to
-- service_role. Without the explicit grant the REVOKE FROM PUBLIC also locks
-- out service_role, since the default access path is via PUBLIC.
REVOKE ALL ON FUNCTION public.prepare_user_deletion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_user_deletion(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.prepare_user_deletion(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.prepare_user_deletion(UUID) TO service_role;

-- Verification
DO $$
DECLARE
  audit_fk_action TEXT;
  newsletter_nullable TEXT;
  fn_exists BOOLEAN;
BEGIN
  SELECT confdeltype::TEXT INTO audit_fk_action
  FROM pg_constraint
  WHERE conname = 'version_audit_flags_resolved_by_fkey';

  SELECT is_nullable INTO newsletter_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'newsletter_custom_sends'
    AND column_name = 'sent_by';

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'prepare_user_deletion'
  ) INTO fn_exists;

  RAISE NOTICE 'version_audit_flags.resolved_by ON DELETE = % (expected: n for SET NULL)', audit_fk_action;
  RAISE NOTICE 'newsletter_custom_sends.sent_by is_nullable = % (expected: YES)', newsletter_nullable;
  RAISE NOTICE 'prepare_user_deletion function exists = %', fn_exists;
END $$;
