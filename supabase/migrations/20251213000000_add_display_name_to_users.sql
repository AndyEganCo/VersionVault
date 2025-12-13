-- Add display_name column to users table for onboarding
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name);
