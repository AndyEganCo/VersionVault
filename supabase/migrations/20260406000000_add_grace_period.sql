-- Add grace period tracking for freemium migration
-- Existing free users tracking >5 apps get 30 days to adjust

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS grace_period_start TIMESTAMPTZ DEFAULT NULL;

-- Add grace_period_emails_sent to track which emails have been sent
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS grace_period_emails_sent TEXT[] DEFAULT '{}';

-- Initialize grace period for existing free users with >5 tracked apps
-- This should be run on launch day
-- (Premium users and legacy premium users are excluded)
UPDATE public.user_settings us
SET grace_period_start = NOW()
WHERE us.user_id NOT IN (
  SELECT user_id FROM public.premium_users
)
AND (
  SELECT COUNT(*) FROM public.tracked_software ts
  WHERE ts.user_id = us.user_id
) > 5;

-- Index for efficient grace period queries
CREATE INDEX IF NOT EXISTS idx_user_settings_grace_period
ON public.user_settings (grace_period_start)
WHERE grace_period_start IS NOT NULL;
