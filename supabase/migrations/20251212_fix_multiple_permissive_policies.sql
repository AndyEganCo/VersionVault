-- =============================================
-- FIX MULTIPLE PERMISSIVE POLICIES
-- =============================================
-- This migration fixes multiple permissive policy warnings by:
-- 1. Converting "FOR ALL" service role policies to "TO service_role"
-- 2. Consolidating overlapping user/admin policies
-- 3. Removing redundant policies
--
-- Issue: Multiple permissive policies execute for each query, causing performance issues
-- Fix: Consolidate policies to have only one policy per role+action combination
-- =============================================

-- ============================================
-- 1. Fix email_bounces policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own bounces" ON email_bounces;
DROP POLICY IF EXISTS "Service role can manage all bounces" ON email_bounces;

-- Create consolidated SELECT policy for authenticated users
CREATE POLICY "Users can view their own bounces" ON email_bounces
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Create service role policy (using TO instead of USING to avoid overlap)
CREATE POLICY "Service role can manage all bounces" ON email_bounces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Fix newsletter_logs policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own email logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Service role can manage all logs" ON newsletter_logs;

-- Consolidated policy: Users see their own logs, admins see all logs
CREATE POLICY "Users and admins can view logs" ON newsletter_logs
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

CREATE POLICY "Service role can manage all logs" ON newsletter_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. Fix newsletter_queue policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can view all queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can insert queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can update queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Service role can manage all queue items" ON newsletter_queue;

-- Consolidated SELECT: Users see their own, admins see all
CREATE POLICY "Users and admins can view queue items" ON newsletter_queue
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

-- Admins can INSERT
CREATE POLICY "Admins can insert queue items" ON newsletter_queue
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Admins can UPDATE
CREATE POLICY "Admins can update queue items" ON newsletter_queue
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Service role has full access
CREATE POLICY "Service role can manage all queue items" ON newsletter_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. Fix newsletter_sponsors policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can view all sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can insert sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can update sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can delete sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Service role can manage sponsors" ON newsletter_sponsors;

-- Public can view active sponsors, admins can view all
CREATE POLICY "Public and admins can view sponsors" ON newsletter_sponsors
  FOR SELECT
  USING (
    is_active = true
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

-- Admins can manage sponsors
CREATE POLICY "Admins can insert sponsors" ON newsletter_sponsors
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update sponsors" ON newsletter_sponsors
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete sponsors" ON newsletter_sponsors
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Service role has full access
CREATE POLICY "Service role can manage sponsors" ON newsletter_sponsors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. Fix scraping_patterns policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can insert scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can update scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can delete scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Service role can manage scraping patterns" ON scraping_patterns;

-- Admins only
CREATE POLICY "Admins can view scraping patterns" ON scraping_patterns
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can insert scraping patterns" ON scraping_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update scraping patterns" ON scraping_patterns
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete scraping patterns" ON scraping_patterns
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Service role has full access
CREATE POLICY "Service role can manage scraping patterns" ON scraping_patterns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. Fix resend_contact_sync policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all sync records" ON resend_contact_sync;
DROP POLICY IF EXISTS "Service role can manage sync records" ON resend_contact_sync;

-- Admins can view
CREATE POLICY "Admins can view all sync records" ON resend_contact_sync
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Service role has full access
CREATE POLICY "Service role can manage sync records" ON resend_contact_sync
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. Fix software_version_history policies
-- ============================================

DROP POLICY IF EXISTS "Public read access to version history" ON software_version_history;
DROP POLICY IF EXISTS "Authenticated users can view version history" ON software_version_history;
DROP POLICY IF EXISTS "Admins can update version verification" ON software_version_history;
DROP POLICY IF EXISTS "Service role can manage version history" ON software_version_history;

-- Public read access (no need for separate authenticated policy)
CREATE POLICY "Public read access to version history" ON software_version_history
  FOR SELECT
  USING (true);

-- Admins can update
CREATE POLICY "Admins can update version verification" ON software_version_history
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- Service role has full access
CREATE POLICY "Service role can manage version history" ON software_version_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 8. Fix premium_users policies
-- ============================================

DROP POLICY IF EXISTS "Allow all for authenticated users" ON premium_users;
DROP POLICY IF EXISTS "Users can read their own premium status" ON premium_users;

-- Single policy: users can read their own premium status
CREATE POLICY "Users can read their own premium status" ON premium_users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 9. Fix feature_requests policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON feature_requests;

-- Consolidated: Users see own, admins see all
CREATE POLICY "Users and admins can view feature requests" ON feature_requests
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

-- Keep other policies as-is (INSERT, UPDATE, DELETE are separate)

-- ============================================
-- 10. Fix software_requests policies
-- ============================================

DROP POLICY IF EXISTS "Users can read own requests" ON software_requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON software_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON software_requests;
DROP POLICY IF EXISTS "Admins can delete any request" ON software_requests;

-- Consolidated SELECT: Users see own, admins see all
CREATE POLICY "Users and admins can view requests" ON software_requests
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

-- Consolidated DELETE: Users delete own, admins delete any
CREATE POLICY "Users and admins can delete requests" ON software_requests
  FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (select auth.uid()) IN (SELECT user_id FROM admin_users)
  );

-- Keep other policies as-is (INSERT, UPDATE)

-- ============================================
-- 11. Fix app_settings policies
-- ============================================

DROP POLICY IF EXISTS "Service role can manage settings" ON app_settings;

CREATE POLICY "Service role can manage settings" ON app_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
