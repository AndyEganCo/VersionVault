-- Add show_onboarding flag (default true for new users)
-- Note: display_name is stored in auth.users metadata, not public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS show_onboarding BOOLEAN DEFAULT true;

-- Set show_onboarding to false for existing users (they shouldn't see it)
UPDATE public.users
SET show_onboarding = false
WHERE created_at < NOW();
