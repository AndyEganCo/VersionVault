-- Fix search_path for remaining functions
-- Security Issue: Functions need fixed search_path to prevent search path injection attacks
-- This migration adds SET search_path to all remaining functions

-- ============================================
-- Newsletter System Functions
-- ============================================

-- Function to get user's bounce count
CREATE OR REPLACE FUNCTION get_user_bounce_count(p_user_id UUID, p_bounce_type TEXT DEFAULT 'hard')
RETURNS INT
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INT
  FROM email_bounces
  WHERE user_id = p_user_id
  AND bounce_type = p_bounce_type
  AND created_at > now() - INTERVAL '30 days';
$$;

-- Function to check if user should receive emails
CREATE OR REPLACE FUNCTION should_send_email(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
AS $$
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
$$;

-- Function to get active sponsor
CREATE OR REPLACE FUNCTION get_active_sponsor()
RETURNS newsletter_sponsors
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT * FROM newsletter_sponsors
  WHERE is_active = true
  AND (start_date IS NULL OR start_date <= CURRENT_DATE)
  AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LIMIT 1;
$$;

-- ============================================
-- Trigger Functions
-- ============================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Scraping patterns updated_at trigger function
CREATE OR REPLACE FUNCTION update_scraping_patterns_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated all remaining functions with fixed search_path';
  RAISE NOTICE 'Functions updated: get_user_bounce_count, should_send_email, get_active_sponsor, update_updated_at_column, update_scraping_patterns_updated_at';
END $$;
