-- =============================================
-- FIX AMBIGUOUS COLUMN REFERENCES
-- =============================================
-- Run this to fix the "column reference user_id is ambiguous" error
-- =============================================

-- ============================================
-- Fix get_software_requests_with_user function
-- ============================================
DROP FUNCTION IF EXISTS get_software_requests_with_user();

CREATE OR REPLACE FUNCTION get_software_requests_with_user()
RETURNS TABLE (
  id UUID,
  name TEXT,
  website TEXT,
  version_url TEXT,
  description TEXT,
  user_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  approved_by UUID,
  rejected_by UUID,
  software_id UUID,
  user_email TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_user_admin BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- Check if user is admin
  is_user_admin := EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = current_user_id
  );

  IF is_user_admin THEN
    -- Admins see all requests with user info
    RETURN QUERY
    SELECT
      sr.id,
      sr.name,
      sr.website,
      sr.version_url,
      sr.description,
      sr.user_id,
      sr.status,
      sr.created_at,
      sr.rejection_reason,
      sr.approved_at,
      sr.rejected_at,
      sr.approved_by,
      sr.rejected_by,
      sr.software_id,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM software_requests sr
    LEFT JOIN users u ON sr.user_id = u.id
    ORDER BY sr.created_at DESC;
  ELSE
    -- Non-admins only see their own requests
    RETURN QUERY
    SELECT
      sr.id,
      sr.name,
      sr.website,
      sr.version_url,
      sr.description,
      sr.user_id,
      sr.status,
      sr.created_at,
      sr.rejection_reason,
      sr.approved_at,
      sr.rejected_at,
      sr.approved_by,
      sr.rejected_by,
      sr.software_id,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM software_requests sr
    LEFT JOIN users u ON sr.user_id = u.id
    WHERE sr.user_id = current_user_id
    ORDER BY sr.created_at DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_software_requests_with_user() TO authenticated;

COMMENT ON FUNCTION get_software_requests_with_user IS
'Returns software requests with user information. Respects RLS - admins see all, users see only their own.';


-- ============================================
-- Fix get_feature_requests_with_user function
-- ============================================
DROP FUNCTION IF EXISTS get_feature_requests_with_user();

CREATE OR REPLACE FUNCTION get_feature_requests_with_user()
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  user_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  user_email TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_user_admin BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- Check if user is admin
  is_user_admin := EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = current_user_id
  );

  IF is_user_admin THEN
    -- Admins see all requests with user info
    RETURN QUERY
    SELECT
      fr.id,
      fr.title,
      fr.description,
      fr.category,
      fr.user_id,
      fr.status,
      fr.created_at,
      fr.completed_at,
      fr.completed_by,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM feature_requests fr
    LEFT JOIN users u ON fr.user_id = u.id
    ORDER BY fr.created_at DESC;
  ELSE
    -- Non-admins only see their own requests
    RETURN QUERY
    SELECT
      fr.id,
      fr.title,
      fr.description,
      fr.category,
      fr.user_id,
      fr.status,
      fr.created_at,
      fr.completed_at,
      fr.completed_by,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM feature_requests fr
    LEFT JOIN users u ON fr.user_id = u.id
    WHERE fr.user_id = current_user_id
    ORDER BY fr.created_at DESC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feature_requests_with_user() TO authenticated;

COMMENT ON FUNCTION get_feature_requests_with_user IS
'Returns feature requests with user information. Respects RLS - admins see all, users see only their own.';
