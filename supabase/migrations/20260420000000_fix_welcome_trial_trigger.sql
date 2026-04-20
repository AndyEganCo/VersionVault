-- Fix grant_welcome_trial_on_user_create: public.users PK is `id`, not `user_id`.
-- The broken NEW.user_id reference aborted every signup transaction with
-- `record "new" has no field "user_id"` (SQLSTATE 42703).

CREATE OR REPLACE FUNCTION public.grant_welcome_trial_on_user_create()
RETURNS TRIGGER AS $$
BEGIN
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
