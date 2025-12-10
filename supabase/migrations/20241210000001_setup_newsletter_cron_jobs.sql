-- Setup newsletter cron jobs
-- This migration creates all the pg_cron jobs needed for the newsletter system

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing jobs if they exist (to allow re-running this migration)
SELECT cron.unschedule('queue-weekly-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-weekly-digest');
SELECT cron.unschedule('queue-daily-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-daily-digest');
SELECT cron.unschedule('queue-monthly-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'queue-monthly-digest');
SELECT cron.unschedule('process-newsletter-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-newsletter-queue');
SELECT cron.unschedule('cleanup-newsletter-queue') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-newsletter-queue');

-- 1. Queue Weekly Digest (Sunday at 11 PM UTC)
SELECT cron.schedule(
  'queue-weekly-digest',
  '0 23 * * 0',  -- Sunday at 11:00 PM UTC
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    -- Get settings
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    -- Call edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'weekly')
    );
  END $$;
  $$
);

-- 2. Queue Daily Digest (Every day at 11 PM UTC)
SELECT cron.schedule(
  'queue-daily-digest',
  '0 23 * * *',  -- Every day at 11:00 PM UTC
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    -- Get settings
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    -- Call edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'daily')
    );
  END $$;
  $$
);

-- 3. Queue Monthly Digest (1st of month at 11 PM UTC)
SELECT cron.schedule(
  'queue-monthly-digest',
  '0 23 1 * *',  -- 1st of month at 11:00 PM UTC
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    -- Get settings
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    -- Call edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/queue-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('frequency', 'monthly')
    );
  END $$;
  $$
);

-- 4. Process Newsletter Queue (Every hour)
SELECT cron.schedule(
  'process-newsletter-queue',
  '0 * * * *',  -- Every hour at :00
  $$
  DO $$
  DECLARE
    supabase_url TEXT;
    service_key TEXT;
  BEGIN
    -- Get settings
    supabase_url := get_app_setting('supabase_url');
    service_key := get_service_role_key();

    -- Call edge function
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-newsletter-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := '{}'::jsonb
    );
  END $$;
  $$
);

-- 5. Cleanup Newsletter Queue (Sunday at 4 AM UTC)
SELECT cron.schedule(
  'cleanup-newsletter-queue',
  '0 4 * * 0',  -- Sunday at 4:00 AM UTC
  $$
  DELETE FROM newsletter_queue
  WHERE status IN ('sent', 'failed', 'cancelled')
  AND created_at < now() - interval '30 days';
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
