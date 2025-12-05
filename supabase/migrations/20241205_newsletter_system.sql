-- Newsletter System Migration
-- Version Digest email system for VersionVault

-- ============================================
-- 1. Extend tracked_software table
-- ============================================
ALTER TABLE tracked_software
  ADD COLUMN IF NOT EXISTS last_notified_version TEXT,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Index for efficient querying of notification status
CREATE INDEX IF NOT EXISTS idx_tracked_software_last_notified
  ON tracked_software(user_id, last_notified_at);

-- ============================================
-- 2. Extend user_settings table
-- ============================================
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS digest_day TEXT DEFAULT 'monday',
  ADD COLUMN IF NOT EXISTS notifications_paused_until TIMESTAMPTZ;

-- ============================================
-- 3. Newsletter Queue (for scale)
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('weekly_digest', 'daily_digest', 'monthly_digest', 'all_quiet', 'welcome', 'instant_alert')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  resend_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_newsletter_queue_status_scheduled
  ON newsletter_queue(status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_newsletter_queue_user
  ON newsletter_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_queue_idempotency
  ON newsletter_queue(idempotency_key);

-- ============================================
-- 4. Newsletter Logs (sent email history)
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT,
  software_updates JSONB DEFAULT '[]',
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_newsletter_logs_user
  ON newsletter_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_logs_created
  ON newsletter_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_logs_resend_id
  ON newsletter_logs(resend_id);

-- ============================================
-- 5. Email Bounces (for auto-disable)
-- ============================================
CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft')),
  reason TEXT,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for checking bounce count
CREATE INDEX IF NOT EXISTS idx_email_bounces_user
  ON email_bounces(user_id, bounce_type);

-- ============================================
-- 6. Newsletter Sponsors
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  image_url TEXT,
  cta_url TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT 'Learn More',
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_date DATE,
  end_date DATE,
  impression_count INT NOT NULL DEFAULT 0,
  click_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active sponsor at a time (optional constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_sponsors_active
  ON newsletter_sponsors(is_active)
  WHERE is_active = true;

-- ============================================
-- 7. Newsletter Admin Settings
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO newsletter_settings (setting_key, setting_value) VALUES
  ('auto_send_enabled', 'true'),
  ('default_send_hour', '8'),
  ('weekly_digest_day', '"monday"'),
  ('monthly_digest_day', '1'),
  ('all_quiet_messages', '["Your software is suspiciously stable this week. We''re keeping an eye on it.", "Nothing to report. Your apps are quietly doing their jobs.", "Zero updates. Either everything''s perfect, or the calm before the storm.", "All quiet on the version front. Enjoy it while it lasts.", "No updates detected. Time to grab a coffee instead of reading release notes."]')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- 8. Row Level Security (RLS)
-- ============================================

-- Newsletter Queue RLS
ALTER TABLE newsletter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queue items" ON newsletter_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all queue items" ON newsletter_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Logs RLS
ALTER TABLE newsletter_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs" ON newsletter_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all logs" ON newsletter_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Email Bounces RLS
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bounces" ON email_bounces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all bounces" ON email_bounces
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Sponsors RLS (public read, admin write)
ALTER TABLE newsletter_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sponsors" ON newsletter_sponsors
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage sponsors" ON newsletter_sponsors
  FOR ALL USING (auth.role() = 'service_role');

-- Newsletter Settings RLS (admin only)
ALTER TABLE newsletter_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage settings" ON newsletter_settings
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 9. Helper Functions
-- ============================================

-- Function to get user's bounce count
CREATE OR REPLACE FUNCTION get_user_bounce_count(p_user_id UUID, p_bounce_type TEXT DEFAULT 'hard')
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM email_bounces
  WHERE user_id = p_user_id
  AND bounce_type = p_bounce_type
  AND created_at > now() - INTERVAL '30 days';
$$ LANGUAGE SQL STABLE;

-- Function to check if user should receive emails
CREATE OR REPLACE FUNCTION should_send_email(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    COALESCE(
      (SELECT email_notifications FROM user_settings WHERE user_id = p_user_id),
      true
    )
    AND get_user_bounce_count(p_user_id, 'hard') < 3
    AND COALESCE(
      (SELECT notifications_paused_until FROM user_settings WHERE user_id = p_user_id),
      now() - INTERVAL '1 day'
    ) < now();
$$ LANGUAGE SQL STABLE;

-- Function to get active sponsor
CREATE OR REPLACE FUNCTION get_active_sponsor()
RETURNS newsletter_sponsors AS $$
  SELECT * FROM newsletter_sponsors
  WHERE is_active = true
  AND (start_date IS NULL OR start_date <= CURRENT_DATE)
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- 10. Updated_at Triggers
-- ============================================

-- Generic updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to newsletter_queue
DROP TRIGGER IF EXISTS update_newsletter_queue_updated_at ON newsletter_queue;
CREATE TRIGGER update_newsletter_queue_updated_at
  BEFORE UPDATE ON newsletter_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to newsletter_sponsors
DROP TRIGGER IF EXISTS update_newsletter_sponsors_updated_at ON newsletter_sponsors;
CREATE TRIGGER update_newsletter_sponsors_updated_at
  BEFORE UPDATE ON newsletter_sponsors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to newsletter_settings
DROP TRIGGER IF EXISTS update_newsletter_settings_updated_at ON newsletter_settings;
CREATE TRIGGER update_newsletter_settings_updated_at
  BEFORE UPDATE ON newsletter_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
