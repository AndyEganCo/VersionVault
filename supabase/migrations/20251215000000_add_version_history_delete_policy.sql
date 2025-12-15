-- =============================================
-- ADD DELETE AND INSERT POLICIES FOR ADMINS
-- =============================================
-- Admins should be able to delete version history entries
-- and software entries through the UI.
-- Currently only service_role can delete, which prevents
-- admins from managing data through the admin interface.
-- =============================================

-- ============================================
-- 1. Add version history admin policies
-- ============================================

CREATE POLICY "Admins can delete version history" ON software_version_history
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can insert version history" ON software_version_history
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- ============================================
-- 2. Add software table admin policies
-- ============================================

-- Enable RLS on software table if not already enabled
ALTER TABLE software ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Public read access to software" ON software;
DROP POLICY IF EXISTS "Admins can insert software" ON software;
DROP POLICY IF EXISTS "Admins can update software" ON software;
DROP POLICY IF EXISTS "Admins can delete software" ON software;

-- Public can read all software
CREATE POLICY "Public read access to software" ON software
  FOR SELECT
  USING (true);

-- Admins can insert software
CREATE POLICY "Admins can insert software" ON software
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Admins can update software
CREATE POLICY "Admins can update software" ON software
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Admins can delete software
CREATE POLICY "Admins can delete software" ON software
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- ============================================
-- 3. Ensure tracked_software has delete policy
-- ============================================

-- This table needs admins to be able to delete when deleting software
DROP POLICY IF EXISTS "Admins can delete tracked software" ON tracked_software;

CREATE POLICY "Admins can delete tracked software" ON tracked_software
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));
