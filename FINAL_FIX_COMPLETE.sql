-- =============================================
-- COMPLETE FIX FOR AUTO-TRACKING
-- =============================================
-- Run ALL of these in order in Supabase SQL Editor
-- =============================================

-- ============================================
-- 1. Fix check_duplicate_software (TEXT not UUID)
-- ============================================
DROP FUNCTION IF EXISTS check_duplicate_software(text, text);

CREATE OR REPLACE FUNCTION check_duplicate_software(
  p_name TEXT,
  p_website TEXT
)
RETURNS TABLE (
  software_exists BOOLEAN,
  software_id TEXT,  -- TEXT because software.id is TEXT
  software_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE::BOOLEAN as software_exists,
    s.id as software_id,
    s.name as software_name
  FROM software s
  WHERE
    -- Match by name (case-insensitive, trimmed)
    LOWER(TRIM(s.name)) = LOWER(TRIM(p_name))
    OR
    -- Match by website (normalize URLs)
    LOWER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(s.website, '^https?://(www\.)?', ''),
      '/$', ''
    ))) = LOWER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(p_website, '^https?://(www\.)?', ''),
      '/$', ''
    )))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_software(TEXT, TEXT) TO authenticated;


-- ============================================
-- 2. Fix get_software_requests_with_user
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
  software_id TEXT,  -- TEXT not UUID
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
  current_user_id := auth.uid();
  is_user_admin := EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = current_user_id
  );

  IF is_user_admin THEN
    RETURN QUERY
    SELECT
      sr.id, sr.name, sr.website, sr.version_url, sr.description,
      sr.user_id, sr.status, sr.created_at, sr.rejection_reason,
      sr.approved_at, sr.rejected_at, sr.approved_by, sr.rejected_by,
      sr.software_id,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM software_requests sr
    LEFT JOIN users u ON sr.user_id = u.id
    ORDER BY sr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      sr.id, sr.name, sr.website, sr.version_url, sr.description,
      sr.user_id, sr.status, sr.created_at, sr.rejection_reason,
      sr.approved_at, sr.rejected_at, sr.approved_by, sr.rejected_by,
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


-- ============================================
-- 3. Fix get_feature_requests_with_user
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
  current_user_id := auth.uid();
  is_user_admin := EXISTS (
    SELECT 1 FROM admin_users WHERE admin_users.user_id = current_user_id
  );

  IF is_user_admin THEN
    RETURN QUERY
    SELECT
      fr.id, fr.title, fr.description, fr.category, fr.user_id,
      fr.status, fr.created_at, fr.completed_at, fr.completed_by,
      u.email as user_email,
      COALESCE(u.display_name, u.email) as user_name
    FROM feature_requests fr
    LEFT JOIN users u ON fr.user_id = u.id
    ORDER BY fr.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      fr.id, fr.title, fr.description, fr.category, fr.user_id,
      fr.status, fr.created_at, fr.completed_at, fr.completed_by,
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


-- ============================================
-- 4. Add admin policies for tracked_software
-- ============================================
-- CRITICAL: Admins need both INSERT and UPDATE for upsert to work

DROP POLICY IF EXISTS "Admins can track software for any user" ON tracked_software;
DROP POLICY IF EXISTS "Admins can update tracked software" ON tracked_software;

CREATE POLICY "Admins can track software for any user" ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update tracked software" ON tracked_software
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IN (SELECT user_id FROM admin_users))
  WITH CHECK ((SELECT auth.uid()) IN (SELECT user_id FROM admin_users));


-- ============================================
-- VERIFICATION
-- ============================================
-- Verify all functions and policies exist

SELECT 'check_duplicate_software' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'check_duplicate_software') as exists;

SELECT 'get_software_requests_with_user' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_software_requests_with_user') as exists;

SELECT 'get_feature_requests_with_user' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_feature_requests_with_user') as exists;

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'tracked_software'
AND policyname LIKE 'Admins can%'
ORDER BY cmd;
