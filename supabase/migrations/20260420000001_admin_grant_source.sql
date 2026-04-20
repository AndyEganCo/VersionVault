-- Allow 'admin_grant' as a source for premium_grants so admins can manually
-- credit users with Pro time (e.g. to backfill a referral that didn't
-- process, compensate for a bug, or reward an early contributor).

ALTER TABLE public.premium_grants
  DROP CONSTRAINT IF EXISTS premium_grants_source_check;

ALTER TABLE public.premium_grants
  ADD CONSTRAINT premium_grants_source_check
  CHECK (source IN (
    'referral_signup',
    'referral_paid',
    'milestone_bonus',
    'welcome_trial',
    'launch_gift',
    'admin_grant'
  ));
