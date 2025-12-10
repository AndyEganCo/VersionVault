-- Update app settings with actual values
-- This migration should be run AFTER you've updated the values below with your actual configuration

-- IMPORTANT: Replace 'https://your-project.supabase.co' with your actual Supabase URL
-- You can find this in your Supabase dashboard under Settings > API

-- Option 1: Update the Supabase URL
UPDATE app_settings
SET value = 'https://your-project.supabase.co',  -- REPLACE THIS
    updated_at = NOW()
WHERE key = 'supabase_url';

-- Option 2a: Store service role key in app_settings (LESS SECURE - use vault instead if possible)
-- Uncomment and update if you want to use app_settings instead of vault
/*
INSERT INTO app_settings (key, value, description)
VALUES (
  'service_role_key',
  'your-service-role-key-here',  -- REPLACE THIS
  'Service role key for edge function authentication'
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
*/

-- Option 2b: Store service role key in Supabase Vault (RECOMMENDED)
-- Run this SQL in your Supabase SQL Editor to store the key securely:
/*
SELECT vault.create_secret(
  'your-service-role-key-here',  -- REPLACE THIS
  'service_role_key',
  'Service role key for cron job authentication'
);
*/

-- Verify the settings
DO $$
DECLARE
  url_value TEXT;
  key_value TEXT;
BEGIN
  -- Check URL
  SELECT value INTO url_value FROM app_settings WHERE key = 'supabase_url';

  IF url_value LIKE 'https://%' AND url_value NOT LIKE '%your-project%' THEN
    RAISE NOTICE 'Supabase URL configured: %', url_value;
  ELSE
    RAISE WARNING 'Supabase URL needs to be configured. Current value: %', url_value;
  END IF;

  -- Check service role key availability
  BEGIN
    key_value := get_service_role_key();
    IF key_value IS NOT NULL AND length(key_value) > 20 THEN
      RAISE NOTICE 'Service role key is configured (length: % chars)', length(key_value);
    ELSE
      RAISE WARNING 'Service role key needs to be configured';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not verify service role key: %', SQLERRM;
  END;
END $$;
