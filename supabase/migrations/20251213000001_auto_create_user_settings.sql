-- =============================================
-- AUTO-CREATE USER SETTINGS FOR NEW USERS
-- =============================================
-- This migration adds a trigger to automatically create user_settings
-- rows when new users sign up, and backfills existing users

-- ============================================
-- 1. Function to create default user settings
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default settings for the new user
  INSERT INTO public.user_settings (
    user_id,
    email_notifications,
    notification_frequency,
    app_update_notifications,
    timezone,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true,                -- email_notifications default
    'weekly',           -- notification_frequency default
    true,               -- app_update_notifications default
    'America/New_York', -- timezone default
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Create trigger on auth.users
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_settings();

-- ============================================
-- 3. Backfill existing users without settings
-- ============================================
INSERT INTO public.user_settings (
  user_id,
  email_notifications,
  notification_frequency,
  app_update_notifications,
  timezone,
  created_at,
  updated_at
)
SELECT
  au.id,
  true,                -- email_notifications default
  'weekly',           -- notification_frequency default
  true,               -- app_update_notifications default
  'America/New_York', -- timezone default
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.user_settings us ON au.id = us.user_id
WHERE us.user_id IS NULL;

-- ============================================
-- 4. Verify the backfill
-- ============================================
-- This will show how many users now have settings
DO $$
DECLARE
  total_users INT;
  users_with_settings INT;
BEGIN
  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO users_with_settings FROM public.user_settings;

  RAISE NOTICE 'Total users: %', total_users;
  RAISE NOTICE 'Users with settings: %', users_with_settings;

  IF total_users = users_with_settings THEN
    RAISE NOTICE '✓ All users now have settings!';
  ELSE
    RAISE WARNING '⚠ Mismatch: % users missing settings', (total_users - users_with_settings);
  END IF;
END $$;
