-- Fix search_path for SECURITY DEFINER functions
-- Security Issue: Functions with SECURITY DEFINER need fixed search_path to prevent search path injection attacks
-- This migration adds SET search_path to all SECURITY DEFINER functions

-- ============================================
-- 1. Fix get_app_setting function
-- ============================================
CREATE OR REPLACE FUNCTION get_app_setting(setting_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;

  RETURN setting_value;
END;
$$;

-- ============================================
-- 2. Fix get_cron_secret function
-- ============================================
CREATE OR REPLACE FUNCTION get_cron_secret()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  -- Try to get from vault first (Supabase Vault integration)
  BEGIN
    SELECT decrypted_secret INTO secret_value
    FROM vault.decrypted_secrets
    WHERE name = 'cron_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to app_settings if vault is not available
    SELECT value INTO secret_value
    FROM app_settings
    WHERE key = 'cron_secret';
  END;

  RETURN secret_value;
END;
$$;

-- ============================================
-- 3. Fix queue_digest_emails function
-- ============================================
CREATE OR REPLACE FUNCTION queue_digest_emails(frequency TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  supabase_url TEXT;
  cron_secret TEXT;
  response_id bigint;
BEGIN
  -- Get settings
  supabase_url := get_app_setting('supabase_url');
  cron_secret := get_cron_secret();

  -- Validate settings are configured
  IF supabase_url IS NULL OR supabase_url LIKE '%your-project%' THEN
    RAISE WARNING 'Supabase URL not configured in app_settings';
    RETURN;
  END IF;

  IF cron_secret IS NULL OR cron_secret = 'your-cron-secret-here' THEN
    RAISE WARNING 'CRON_SECRET not configured';
    RETURN;
  END IF;

  -- Call edge function with query parameter (more reliable than request body)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/queue-weekly-digest?frequency=' || frequency,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb
  ) INTO response_id;

  RAISE NOTICE 'Queued % digest emails (response id: %)', frequency, response_id;
END;
$$;

-- ============================================
-- 4. Fix process_newsletter_queue function
-- ============================================
CREATE OR REPLACE FUNCTION process_newsletter_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  supabase_url TEXT;
  cron_secret TEXT;
  response_id bigint;
BEGIN
  -- Get settings
  supabase_url := get_app_setting('supabase_url');
  cron_secret := get_cron_secret();

  -- Validate settings are configured
  IF supabase_url IS NULL OR supabase_url LIKE '%your-project%' THEN
    RAISE WARNING 'Supabase URL not configured in app_settings';
    RETURN;
  END IF;

  IF cron_secret IS NULL OR cron_secret = 'your-cron-secret-here' THEN
    RAISE WARNING 'CRON_SECRET not configured';
    RETURN;
  END IF;

  -- Call edge function with Bearer token authentication
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-newsletter-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb
  ) INTO response_id;

  RAISE NOTICE 'Processed newsletter queue (response id: %)', response_id;
END;
$$;

-- ============================================
-- 5. Fix handle_new_user function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- 6. Fix handle_user_updated function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated all SECURITY DEFINER functions with fixed search_path';
END $$;
