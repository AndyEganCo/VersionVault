-- Remove newsletter_settings table
-- The newsletter system now operates based purely on the queue scheduling
-- No need for auto-send toggles - emails send when they're scheduled

-- Drop triggers first
DROP TRIGGER IF EXISTS update_newsletter_settings_updated_at ON newsletter_settings;

-- Drop policies
DROP POLICY IF EXISTS "Admins can view settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON newsletter_settings;
DROP POLICY IF EXISTS "Service role can manage settings" ON newsletter_settings;

-- Drop the table
DROP TABLE IF EXISTS newsletter_settings;
