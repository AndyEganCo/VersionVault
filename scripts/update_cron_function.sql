-- Update the queue_digest_emails function to use query parameters
-- This script updates the existing function to fix the frequency parameter issue
-- Run this in your Supabase SQL Editor

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function was updated
SELECT 'Function updated successfully' as status;
