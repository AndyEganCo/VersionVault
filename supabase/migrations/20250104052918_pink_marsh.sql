-- Add new columns to user_settings if they don't exist
DO $$ 
BEGIN
  -- Add notification_frequency column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'notification_frequency'
  ) THEN
    ALTER TABLE user_settings 
    ADD COLUMN notification_frequency text DEFAULT 'daily';
  END IF;

  -- Add app_update_notifications column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'app_update_notifications'
  ) THEN
    ALTER TABLE user_settings 
    ADD COLUMN app_update_notifications boolean DEFAULT true;
  END IF;

  -- Add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'user_settings' AND constraint_name = 'valid_notification_frequency'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT valid_notification_frequency 
    CHECK (notification_frequency IN ('daily', 'weekly', 'monthly'));
  END IF;
END $$;