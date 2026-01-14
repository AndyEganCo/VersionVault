-- =============================================
-- GET ALL USERS WITH TRACKING STATUS
-- =============================================
-- Returns all users with flag indicating if tracking specific software

CREATE OR REPLACE FUNCTION get_all_users_with_tracking_status(p_software_id TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  is_tracking BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can see users
  IF (SELECT auth.uid()) NOT IN (SELECT admin_users.user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Only admins can view users';
  END IF;

  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email::TEXT AS email,
    u.display_name AS display_name,
    EXISTS(SELECT 1 FROM tracked_software ts WHERE ts.user_id = au.id AND ts.software_id = p_software_id) AS is_tracking
  FROM auth.users au
  LEFT JOIN users u ON au.id = u.id
  ORDER BY au.email ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users_with_tracking_status(TEXT) TO authenticated;

COMMENT ON FUNCTION get_all_users_with_tracking_status IS
'Returns all users with flag indicating if they are tracking the specified software. Admin-only.';
