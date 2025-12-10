-- Setup newsletter cron jobs
-- This migration creates all the pg_cron jobs needed for the newsletter system

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create helper functions for cron jobs to call

-- Function to queue digest emails
CREATE OR REPLACE FUNCTION queue_digest_emails(frequency TEXT)
RETURNS void AS $$
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
    url := supabase_url || '/functions/v1/queue-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := jsonb_build_object('frequency', frequency)
  ) INTO response_id;

  RAISE NOTICE 'Queued % digest emails (response id: %)', frequency, response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process newsletter queue
CREATE OR REPLACE FUNCTION process_newsletter_queue()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION queue_digest_emails(TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION process_newsletter_queue() TO postgres, service_role;

-- Unschedule existing jobs if they exist (to allow re-running this migration)
DO $$
BEGIN
  PERFORM cron.unschedule('queue-weekly-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-weekly-digest');
  PERFORM cron.unschedule('queue-daily-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-daily-digest');
  PERFORM cron.unschedule('queue-monthly-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-monthly-digest');
  PERFORM cron.unschedule('process-newsletter-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-newsletter-queue');
  PERFORM cron.unschedule('cleanup-newsletter-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-newsletter-queue');
END $$;

-- 1. Queue Weekly Digest (Sunday at 11 PM UTC)
SELECT cron.schedule(
  'queue-weekly-digest',
  '0 23 * * 0',  -- Sunday at 11:00 PM UTC
  $$SELECT queue_digest_emails('weekly')$$
);

-- 2. Queue Daily Digest (Every day at 11 PM UTC)
SELECT cron.schedule(
  'queue-daily-digest',
  '0 23 * * *',  -- Every day at 11:00 PM UTC
  $$SELECT queue_digest_emails('daily')$$
);

-- 3. Queue Monthly Digest (1st of month at 11 PM UTC)
SELECT cron.schedule(
  'queue-monthly-digest',
  '0 23 1 * *',  -- 1st of month at 11:00 PM UTC
  $$SELECT queue_digest_emails('monthly')$$
);

-- 4. Process Newsletter Queue (Every hour)
SELECT cron.schedule(
  'process-newsletter-queue',
  '0 * * * *',  -- Every hour at :00
  $$SELECT process_newsletter_queue()$$
);

-- 5. Cleanup Newsletter Queue (Sunday at 4 AM UTC)
SELECT cron.schedule(
  'cleanup-newsletter-queue',
  '0 4 * * 0',  -- Sunday at 4:00 AM UTC
  $$
  DELETE FROM newsletter_queue
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND created_at < now() - interval '30 days'
  $$
);

-- Verify cron jobs were created
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname IN (
    'queue-weekly-digest',
    'queue-daily-digest',
    'queue-monthly-digest',
    'process-newsletter-queue',
    'cleanup-newsletter-queue'
  );

  IF job_count = 5 THEN
    RAISE NOTICE 'Successfully created all 5 newsletter cron jobs';
  ELSE
    RAISE WARNING 'Expected 5 cron jobs but found %', job_count;
  END IF;
END $$;
