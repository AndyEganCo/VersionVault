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

-- Insert placeholder for Supabase URL (to be updated with actual value)
INSERT INTO app_settings (key, value, description)
VALUES (
  'supabase_url',
  'https://your-project.supabase.co',
  'Supabase project URL for edge function calls'
)
ON CONFLICT (key) DO NOTHING;

-- Create helper function to get service role key from vault
-- Note: The service role key should be stored in Supabase Vault with id 'service_role_key'
CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS TEXT AS $$
DECLARE
  key_value TEXT;
BEGIN
  -- Try to get from vault first (Supabase Vault integration)
  BEGIN
    SELECT decrypted_secret INTO key_value
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to app_settings if vault is not available
    SELECT value INTO key_value
    FROM app_settings
    WHERE key = 'service_role_key';
  END;

  RETURN key_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_app_setting(TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION get_service_role_key() TO postgres, service_role;

-- Create a comment to remind about configuration
COMMENT ON TABLE app_settings IS 'Application configuration settings. Update supabase_url with actual project URL. Service role key should be stored in Supabase Vault or app_settings table.';
