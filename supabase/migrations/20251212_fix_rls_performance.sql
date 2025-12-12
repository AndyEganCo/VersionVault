-- =============================================
-- FIX RLS PERFORMANCE ISSUES
-- =============================================
-- This migration fixes auth_rls_initplan warnings by wrapping auth functions
-- in subselects to prevent re-evaluation for each row.
--
-- Issue: auth.uid() and auth.role() are re-evaluated for each row
-- Fix: Use (select auth.uid()) and (select auth.role()) instead
--
-- Also removes duplicate indexes
-- =============================================

-- ============================================
-- 1. Fix admin_users RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can read their own admin status" ON admin_users;
DROP POLICY IF EXISTS "Admins can insert admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can delete admin_users" ON admin_users;

CREATE POLICY "Users can read their own admin status" ON admin_users
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- ============================================
-- 2. Fix feature_requests RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can insert own feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Users can view own feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can view all feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can update all feature requests" ON feature_requests;
DROP POLICY IF EXISTS "Admins can delete all feature requests" ON feature_requests;

CREATE POLICY "Users can insert own feature requests" ON feature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own feature requests" ON feature_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all feature requests" ON feature_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update all feature requests" ON feature_requests
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete all feature requests" ON feature_requests
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- ============================================
-- 3. Fix software_requests RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can read own requests" ON software_requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON software_requests;
DROP POLICY IF EXISTS "Users can insert requests" ON software_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON software_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON software_requests;
DROP POLICY IF EXISTS "Admins can delete any request" ON software_requests;
DROP POLICY IF EXISTS "Users can view their own software requests" ON software_requests;
DROP POLICY IF EXISTS "Users can create software requests" ON software_requests;

CREATE POLICY "Users can read own requests" ON software_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can read all requests" ON software_requests
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Users can insert requests" ON software_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Admins can update requests" ON software_requests
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users))
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Users can delete own requests" ON software_requests
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can delete any request" ON software_requests
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

-- ============================================
-- 4. Fix scraping_patterns RLS policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can insert scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can update scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Admins can delete scraping patterns" ON scraping_patterns;
DROP POLICY IF EXISTS "Service role can manage scraping patterns" ON scraping_patterns;

CREATE POLICY "Admins can view scraping patterns" ON scraping_patterns
  FOR SELECT
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can insert scraping patterns" ON scraping_patterns
  FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update scraping patterns" ON scraping_patterns
  FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete scraping patterns" ON scraping_patterns
  FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage scraping patterns" ON scraping_patterns
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 5. Fix newsletter_queue RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can view all queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can insert queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can update queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Service role can manage all queue items" ON newsletter_queue;

CREATE POLICY "Users can view their own queue items" ON newsletter_queue
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all queue items" ON newsletter_queue
  FOR SELECT
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can insert queue items" ON newsletter_queue
  FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update queue items" ON newsletter_queue
  FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage all queue items" ON newsletter_queue
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 6. Fix newsletter_logs RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own email logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Service role can manage all logs" ON newsletter_logs;

CREATE POLICY "Users can view their own email logs" ON newsletter_logs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins can view all logs" ON newsletter_logs
  FOR SELECT
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage all logs" ON newsletter_logs
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 7. Fix email_bounces RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own bounces" ON email_bounces;
DROP POLICY IF EXISTS "Service role can manage all bounces" ON email_bounces;

CREATE POLICY "Users can view their own bounces" ON email_bounces
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage all bounces" ON email_bounces
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 8. Fix newsletter_sponsors RLS policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can insert sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can update sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can delete sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Service role can manage sponsors" ON newsletter_sponsors;

CREATE POLICY "Admins can view all sponsors" ON newsletter_sponsors
  FOR SELECT
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can insert sponsors" ON newsletter_sponsors
  FOR INSERT
  WITH CHECK ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can update sponsors" ON newsletter_sponsors
  FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Admins can delete sponsors" ON newsletter_sponsors
  FOR DELETE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage sponsors" ON newsletter_sponsors
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 9. Fix software_version_history RLS policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view version history" ON software_version_history;
DROP POLICY IF EXISTS "Admins can update version verification" ON software_version_history;
DROP POLICY IF EXISTS "Service role can manage version history" ON software_version_history;

CREATE POLICY "Authenticated users can view version history" ON software_version_history
  FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Admins can update version verification" ON software_version_history
  FOR UPDATE
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage version history" ON software_version_history
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 10. Fix version_checks RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can create version checks" ON version_checks;
DROP POLICY IF EXISTS "Users can insert version checks" ON version_checks;

CREATE POLICY "Users can create version checks" ON version_checks
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================
-- 11. Fix users RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can update own record" ON users;

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id);

-- ============================================
-- 12. Fix user_settings RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

CREATE POLICY "Users can read own settings" ON user_settings
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 13. Fix notifications RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 14. Fix tracked_software RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their tracked software" ON tracked_software;
DROP POLICY IF EXISTS "Users can track software for themselves" ON tracked_software;
DROP POLICY IF EXISTS "Users can untrack their software" ON tracked_software;

CREATE POLICY "Users can view their tracked software" ON tracked_software
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can track software for themselves" ON tracked_software
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can untrack their software" ON tracked_software
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 15. Fix premium_users RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can read their own premium status" ON premium_users;

CREATE POLICY "Users can read their own premium status" ON premium_users
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================
-- 16. Fix resend_contact_sync RLS policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all sync records" ON resend_contact_sync;
DROP POLICY IF EXISTS "Service role can manage sync records" ON resend_contact_sync;

CREATE POLICY "Admins can view all sync records" ON resend_contact_sync
  FOR SELECT
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

CREATE POLICY "Service role can manage sync records" ON resend_contact_sync
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 17. Fix app_settings RLS policies
-- ============================================

DROP POLICY IF EXISTS "Service role can manage settings" ON app_settings;

CREATE POLICY "Service role can manage settings" ON app_settings
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 18. Remove duplicate indexes
-- ============================================

-- Drop duplicate index on software_version_history
DROP INDEX IF EXISTS idx_software_version_history_detected_at;
-- Keep idx_version_history_detected_at

-- Drop duplicate index on version_checks
DROP INDEX IF EXISTS idx_version_checks_software_id;
-- Keep version_checks_software_id_idx

-- ============================================
-- 19. Consolidate duplicate software policies
-- ============================================

-- Remove duplicate "Anyone can read software" policy if it exists
-- (keeping "Public read access to software")
DROP POLICY IF EXISTS "Anyone can read software" ON software;

-- Remove duplicate version history policy
DROP POLICY IF EXISTS "Anyone can read version history" ON software_version_history;
