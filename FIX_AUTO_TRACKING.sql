-- =============================================
-- FIX AUTO-TRACKING AND DUPLICATE DETECTION
-- =============================================
-- Run this SQL in your Supabase SQL Editor
-- This fixes all the missing RPC functions and policies
-- =============================================

-- ============================================
-- 1. Ensure software_requests has all needed columns
-- ============================================
-- Add columns if they don't exist (these are used by the app)

ALTER TABLE software_requests
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS software_id UUID REFERENCES software(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_software_requests_software_id ON software_requests(software_id);
CREATE INDEX IF NOT EXISTS idx_software_requests_approved_by ON software_requests(approved_by);


-- ============================================
-- 2. Create check_duplicate_software RPC function
-- ============================================
-- Drop existing function first if it exists
DROP FUNCTION IF EXISTS check_duplicate_software(text, text);

-- Now create the function
CREATE OR REPLACE FUNCTION check_duplicate_software(
  p_name TEXT,
  p_website TEXT
)
RETURNS TABLE (
  software_exists BOOLEAN,
  software_id UUID,
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
    -- Match by website (normalize URLs - remove protocol and www)
    LOWER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(s.website, '^https?://(www\.)?', ''),
      '/$', ''
    ))) = LOWER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(p_website, '^https?://(www\.)?', ''),
      '/$', ''
    )))
  LIMIT 1;

  -- If no match found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TEXT;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_duplicate_software(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION check_duplicate_software IS
'Checks if software already exists by name or website. Used to prevent duplicate software requests.';


-- ============================================
-- 3. Create get_software_requests_with_user RPC function
-- ============================================
-- Drop existing function first if it exists
DROP FUNCTION IF EXISTS get_software_requests_with_user();

-- Now create the function
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
BEGIN
  -- Check if user is admin
  IF (SELECT auth.uid()) IN (SELECT user_id FROM admin_users) THEN
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
    WHERE sr.user_id = (SELECT auth.uid())
    ORDER BY sr.created_at DESC;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_software_requests_with_user() TO authenticated;

COMMENT ON FUNCTION get_software_requests_with_user IS
'Returns software requests with user information. Respects RLS - admins see all, users see only their own.';


-- ============================================
-- 4. Create get_feature_requests_with_user RPC function
-- ============================================
-- Drop existing function first if it exists
DROP FUNCTION IF EXISTS get_feature_requests_with_user();

-- Now create the function
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
BEGIN
  -- Check if user is admin
  IF (SELECT auth.uid()) IN (SELECT user_id FROM admin_users) THEN
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
    WHERE fr.user_id = (SELECT auth.uid())
    ORDER BY fr.created_at DESC;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_feature_requests_with_user() TO authenticated;

COMMENT ON FUNCTION get_feature_requests_with_user IS
'Returns feature requests with user information. Respects RLS - admins see all, users see only their own.';


-- ============================================
-- 5. Add admin INSERT policy for tracked_software
-- ============================================
-- This is CRITICAL for auto-tracking to work!
-- Without this, admins cannot track software on behalf of users

-- Drop if exists to avoid errors on re-run
DROP POLICY IF EXISTS "Admins can track software for any user" ON tracked_software;

-- Create the policy
CREATE POLICY "Admins can track software for any user" ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

COMMENT ON POLICY "Admins can track software for any user" ON tracked_software IS
'Allows admins to auto-track software for users when approving software requests.';


-- ============================================
-- 6. Add performance indexes
-- ============================================
-- These improve query performance for duplicate checking

CREATE INDEX IF NOT EXISTS idx_software_name_lower
  ON software(LOWER(TRIM(name)));

CREATE INDEX IF NOT EXISTS idx_software_website_normalized
  ON software(LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/$', ''))));


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything is working:

-- Test duplicate checking:
-- SELECT * FROM check_duplicate_software('Chrome', 'https://www.google.com/chrome/');

-- Test requests with user info (as admin):
-- SELECT * FROM get_software_requests_with_user();

-- Verify the admin policy exists:
-- SELECT * FROM pg_policies WHERE tablename = 'tracked_software' AND policyname = 'Admins can track software for any user';
