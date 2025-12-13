-- Add display_name column to users table for onboarding
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add show_onboarding flag (default true for new users)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS show_onboarding BOOLEAN DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name);

-- Set show_onboarding to false for existing users (they shouldn't see it)
UPDATE public.users
SET show_onboarding = false
WHERE created_at < NOW();
