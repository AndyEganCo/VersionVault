-- Setup app configuration settings for cron jobs
-- This migration creates the infrastructure needed to store Supabase URL and access secrets

-- Create a simple settings table for non-sensitive configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write settings
CREATE POLICY "Service role can manage settings" ON app_settings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Create helper function to get settings
CREATE OR REPLACE FUNCTION get_app_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;

  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert Supabase URL
INSERT INTO app_settings (key, value, description)
VALUES (
  'supabase_url',
  'https://idlkxmbymqduafgatdwd.supabase.co',
  'Supabase project URL for edge function calls'
)
ON CONFLICT (key) DO NOTHING;

-- Insert placeholder for CRON_SECRET (to be updated with actual value)
INSERT INTO app_settings (key, value, description)
VALUES (
  'cron_secret',
  'your-cron-secret-here',
  'Bearer token for authenticating cron job requests to edge functions'
)
ON CONFLICT (key) DO NOTHING;

-- Create helper function to get cron secret
CREATE OR REPLACE FUNCTION get_cron_secret()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_app_setting(TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION get_cron_secret() TO postgres, service_role;

-- Create a comment to remind about configuration
COMMENT ON TABLE app_settings IS 'Application configuration settings. Update supabase_url with actual project URL. CRON_SECRET should be stored in Supabase Vault or app_settings table.';
