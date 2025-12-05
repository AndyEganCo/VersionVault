-- Newsletter System Migration FIX
-- Run this to clean up and re-apply policies

-- ============================================
-- Drop existing policies (if they exist)
-- ============================================

-- Newsletter Queue policies
DROP POLICY IF EXISTS "Users can view their own queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can view all queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can insert queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Admins can update queue items" ON newsletter_queue;
DROP POLICY IF EXISTS "Service role can manage all queue items" ON newsletter_queue;

-- Newsletter Logs policies
DROP POLICY IF EXISTS "Users can view their own email logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON newsletter_logs;
DROP POLICY IF EXISTS "Service role can manage all logs" ON newsletter_logs;

-- Email Bounces policies
DROP POLICY IF EXISTS "Users can view their own bounces" ON email_bounces;
DROP POLICY IF EXISTS "Service role can manage all bounces" ON email_bounces;

-- Newsletter Sponsors policies
DROP POLICY IF EXISTS "Anyone can view active sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can view all sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can insert sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can update sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Admins can delete sponsors" ON newsletter_sponsors;
DROP POLICY IF EXISTS "Service role can manage sponsors" ON newsletter_sponsors;

-- Newsletter Settings policies
DROP POLICY IF EXISTS "Admins can view settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Service role can manage settings" ON newsletter_settings;

-- ============================================
-- Re-create all policies
-- ============================================

-- Newsletter Queue RLS
CREATE POLICY "Users can view their own queue items" ON newsletter_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all queue items" ON newsletter_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert queue items" ON newsletter_queue
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update queue items" ON newsletter_queue
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage all queue items" ON newsletter_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Logs RLS
CREATE POLICY "Users can view their own email logs" ON newsletter_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all logs" ON newsletter_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage all logs" ON newsletter_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Email Bounces RLS
CREATE POLICY "Users can view their own bounces" ON email_bounces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all bounces" ON email_bounces
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Sponsors RLS
CREATE POLICY "Anyone can view active sponsors" ON newsletter_sponsors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all sponsors" ON newsletter_sponsors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert sponsors" ON newsletter_sponsors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update sponsors" ON newsletter_sponsors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can delete sponsors" ON newsletter_sponsors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage sponsors" ON newsletter_sponsors
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Settings RLS
CREATE POLICY "Admins can view settings" ON newsletter_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert settings" ON newsletter_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update settings" ON newsletter_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage settings" ON newsletter_settings
  FOR ALL USING (auth.role() = 'service_role');
