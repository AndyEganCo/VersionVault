-- =============================================
-- ADD ADMIN TRACKING RPC FUNCTION
-- =============================================
-- This bypasses RLS issues by using SECURITY DEFINER
-- =============================================

CREATE OR REPLACE FUNCTION admin_track_software_for_user(
  p_user_id UUID,
  p_software_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  is_admin := (SELECT auth.uid()) IN (SELECT user_id FROM admin_users);

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can track software for other users';
  END IF;

  -- Use upsert to track software
  INSERT INTO tracked_software (id, user_id, software_id, created_at)
  VALUES (gen_random_uuid(), p_user_id, p_software_id, NOW())
  ON CONFLICT (user_id, software_id)
  DO UPDATE SET created_at = NOW();

  RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error: % - %', SQLSTATE, SQLERRM;
  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_track_software_for_user(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION admin_track_software_for_user IS
'Allows admins to track software for users. Used for auto-tracking on approval. Uses SECURITY DEFINER to bypass RLS.';
