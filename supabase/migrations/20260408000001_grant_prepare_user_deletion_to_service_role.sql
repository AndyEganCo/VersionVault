-- Fix prepare_user_deletion permissions.
--
-- The previous migration (20260408000000_safe_user_deletion.sql) revoked
-- EXECUTE on prepare_user_deletion from PUBLIC without granting it to
-- service_role. PostgreSQL's default EXECUTE on new functions is granted via
-- PUBLIC, so revoking that grant locked out service_role too -- and the
-- delete-user edge function uses service_role to call this RPC. Result: every
-- delete attempt failed with "Failed to prepare user deletion" (Postgres
-- 42501 insufficient_privilege).
--
-- Other RPCs in this codebase (e.g. track_ai_usage, get_audit_flagged_software_ids)
-- explicitly GRANT EXECUTE TO service_role. Match that pattern.

GRANT EXECUTE ON FUNCTION public.prepare_user_deletion(UUID) TO service_role;

-- Verification
DO $$
DECLARE
  has_execute BOOLEAN;
BEGIN
  SELECT has_function_privilege('service_role', 'public.prepare_user_deletion(uuid)', 'EXECUTE')
    INTO has_execute;
  RAISE NOTICE 'service_role can EXECUTE prepare_user_deletion: % (expected: t)', has_execute;
END $$;
