-- Fix user_settings foreign key constraint
-- This ensures the relationship query works in the edge function

-- Drop existing constraint if it exists (without error if it doesn't)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_settings_user_id_fkey'
  ) THEN
    ALTER TABLE user_settings DROP CONSTRAINT user_settings_user_id_fkey;
  END IF;
END $$;

-- Add proper foreign key constraint
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_notification_frequency ON user_settings(notification_frequency);
CREATE INDEX IF NOT EXISTS idx_user_settings_email_notifications ON user_settings(email_notifications);

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_settings_user_id_fkey'
    AND table_name = 'user_settings'
  ) THEN
    RAISE NOTICE 'Foreign key constraint created successfully';
  ELSE
    RAISE WARNING 'Foreign key constraint was not created';
  END IF;
END $$;
