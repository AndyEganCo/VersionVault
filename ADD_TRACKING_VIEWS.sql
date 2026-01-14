-- =============================================
-- ADD TRACKING COUNT VIEWS FOR ADMIN
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This adds RPC functions for viewing tracking statistics
-- =============================================

-- ============================================
-- 1. Get tracking counts for all software
-- ============================================
-- Returns software_id and count of users tracking each

CREATE OR REPLACE FUNCTION get_software_tracking_counts()
RETURNS TABLE (
  software_id UUID,
  tracking_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can see tracking counts
  IF (SELECT auth.uid()) NOT IN (SELECT user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Only admins can view tracking statistics';
  END IF;

  RETURN QUERY
  SELECT
    ts.software_id,
    COUNT(*)::BIGINT as tracking_count
  FROM tracked_software ts
  GROUP BY ts.software_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_software_tracking_counts() TO authenticated;

COMMENT ON FUNCTION get_software_tracking_counts IS
'Returns count of users tracking each software. Admin-only.';


-- ============================================
-- 2. Get users tracking a specific software
-- ============================================
-- Returns detailed user info for users tracking a specific software

CREATE OR REPLACE FUNCTION get_users_tracking_software(p_software_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  tracked_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  is_premium BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can see who tracks software
  IF (SELECT auth.uid()) NOT IN (SELECT user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Only admins can view tracking users';
  END IF;

  RETURN QUERY
  SELECT
    ts.user_id,
    au.email,
    u.display_name,
    ts.created_at as tracked_at,
    (au.id IN (SELECT user_id FROM admin_users)) as is_admin,
    (au.id IN (SELECT user_id FROM premium_users)) as is_premium
  FROM tracked_software ts
  INNER JOIN auth.users au ON ts.user_id = au.id
  LEFT JOIN users u ON ts.user_id = u.id
  WHERE ts.software_id = p_software_id
  ORDER BY ts.created_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_users_tracking_software(UUID) TO authenticated;

COMMENT ON FUNCTION get_users_tracking_software IS
'Returns users tracking a specific software with their details. Admin-only.';


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is working:

-- Test tracking counts (as admin):
-- SELECT * FROM get_software_tracking_counts();

-- Test users tracking specific software (replace with real software_id):
-- SELECT * FROM get_users_tracking_software('00000000-0000-0000-0000-000000000000');

-- Verify the functions exist:
-- SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%tracking%';
