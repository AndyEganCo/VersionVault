-- =============================================
-- USER SOFTWARE TRACKING VIEW
-- =============================================
-- Shows all software with tracking status for a specific user

-- Get all software with tracking status for a user
CREATE OR REPLACE FUNCTION get_user_software_tracking_status(p_user_id UUID)
RETURNS TABLE (
  software_id TEXT,
  software_name TEXT,
  manufacturer TEXT,
  category TEXT,
  current_version TEXT,
  is_tracking BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can view user tracking
  IF (SELECT auth.uid()) NOT IN (SELECT admin_users.user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Only admins can view user tracking';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS software_id,
    s.name AS software_name,
    s.manufacturer,
    s.category,
    s.current_version,
    EXISTS(SELECT 1 FROM tracked_software ts WHERE ts.software_id = s.id AND ts.user_id = p_user_id) AS is_tracking
  FROM software s
  ORDER BY s.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_software_tracking_status(UUID) TO authenticated;

COMMENT ON FUNCTION get_user_software_tracking_status IS
'Returns all software with tracking status for a specific user. Admin-only.';


-- Get tracking count for each user
CREATE OR REPLACE FUNCTION get_user_tracking_counts()
RETURNS TABLE (
  user_id UUID,
  tracking_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can see user tracking counts
  IF (SELECT auth.uid()) NOT IN (SELECT admin_users.user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Only admins can view user tracking statistics';
  END IF;

  RETURN QUERY
  SELECT
    ts.user_id,
    COUNT(*)::BIGINT as tracking_count
  FROM tracked_software ts
  GROUP BY ts.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_tracking_counts() TO authenticated;

COMMENT ON FUNCTION get_user_tracking_counts IS
'Returns count of software tracked by each user. Admin-only.';
