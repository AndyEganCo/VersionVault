-- Update app settings with actual values
-- This migration should be run AFTER you've updated the values below with your actual configuration

-- IMPORTANT: Update the CRON_SECRET below with your actual cron authentication token
-- This is the same bearer token you use for other cron jobs

-- Supabase URL is already configured
-- If you need to change it:
-- UPDATE app_settings SET value = 'https://your-project.supabase.co' WHERE key = 'supabase_url';

-- Option 1: Store CRON_SECRET in app_settings (SIMPLE)
-- Uncomment and update with your actual cron secret:
/*
UPDATE app_settings
SET value = 'e8c3995b0665afea5b488d97c528a1564136f3c8eb878c1d23ecde27d54a0912',  -- REPLACE THIS
    updated_at = NOW()
WHERE key = 'cron_secret';
*/

-- Option 2: Store CRON_SECRET in Supabase Vault (MORE SECURE)
-- Run this SQL in your Supabase SQL Editor:
/*
SELECT vault.create_secret(
  'e8c3995b0665afea5b488d97c528a1564136f3c8eb878c1d23ecde27d54a0912',  -- REPLACE THIS
  'cron_secret',
  'Bearer token for authenticating cron job requests'
);
*/

-- Verify the settings
DO $$
DECLARE
  url_value TEXT;
  secret_value TEXT;
BEGIN
  -- Check URL
  SELECT value INTO url_value FROM app_settings WHERE key = 'supabase_url';

  IF url_value LIKE 'https://%' AND url_value NOT LIKE '%your-project%' THEN
    RAISE NOTICE 'Supabase URL configured: %', url_value;
  ELSE
    RAISE WARNING 'Supabase URL needs to be configured. Current value: %', url_value;
  END IF;

  -- Check CRON_SECRET availability (check table directly)
  SELECT value INTO secret_value FROM app_settings WHERE key = 'cron_secret';

  IF secret_value IS NOT NULL AND secret_value != 'your-cron-secret-here' AND length(secret_value) > 20 THEN
    RAISE NOTICE 'CRON_SECRET is configured (length: % chars)', length(secret_value);
  ELSE
    RAISE WARNING 'CRON_SECRET needs to be configured in app_settings';
  END IF;
END $$;
