-- Auto-grant 30-day Pro trial for new users
-- Creates a premium_grant with source 'welcome_trial' when a user is created

-- Function to grant welcome trial
CREATE OR REPLACE FUNCTION public.grant_welcome_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant to new users (INSERT trigger)
  -- Insert a premium_grant record for 30-day trial
  INSERT INTO public.premium_grants (
    user_id,
    months_granted,
    source,
    expires_at
  ) VALUES (
    NEW.id,
    1,
    'welcome_trial',
    NOW() + INTERVAL '30 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users creation (fires after Supabase creates the user)
-- Note: This trigger fires on the public.users table which is populated
-- by an existing trigger/insert when auth.users is created
CREATE OR REPLACE FUNCTION public.grant_welcome_trial_on_user_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.premium_grants (
    user_id,
    months_granted,
    source,
    expires_at
  ) VALUES (
    NEW.user_id,
    1,
    'welcome_trial',
    NOW() + INTERVAL '30 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on public.users table (populated when users sign up)
DROP TRIGGER IF EXISTS on_user_created_grant_trial ON public.users;
CREATE TRIGGER on_user_created_grant_trial
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_welcome_trial_on_user_create();
