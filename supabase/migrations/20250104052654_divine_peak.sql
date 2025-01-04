-- Add new columns to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS notification_frequency text DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS app_update_notifications boolean DEFAULT true;

-- Add constraint for notification_frequency
ALTER TABLE user_settings
ADD CONSTRAINT valid_notification_frequency 
CHECK (notification_frequency IN ('daily', 'weekly', 'monthly'));