-- Launch gift: give every existing user 1 free month of Pro.
--
-- This replaces the original 30-day "grace period" concept with a simpler,
-- more generous model: instead of counting down toward auto-untracking, every
-- existing user gets a real Pro grant for 30 days. When it expires, the
-- existing enforce-grace-period cron catches users who are over the free
-- tier's 5-app limit and begins the winddown flow via the same email
-- templates we already use for subscription end.
--
-- Mechanism: insert a premium_grants row with source='launch_gift'. The
-- existing trigger_update_granted_until() fires automatically and syncs
-- premium_users.granted_until to MAX(expires_at) across all active grants,
-- so users who already have referral grants or welcome_trial time simply
-- stack this on top.

-- 1. Allow 'launch_gift' as a valid premium_grants source.
ALTER TABLE public.premium_grants
  DROP CONSTRAINT IF EXISTS premium_grants_source_check;

ALTER TABLE public.premium_grants
  ADD CONSTRAINT premium_grants_source_check
  CHECK (source IN (
    'referral_signup',
    'referral_paid',
    'milestone_bonus',
    'welcome_trial',
    'launch_gift'
  ));

-- 2. Grant 1 month of Pro to every existing user.
--
-- We skip users who already received a launch_gift (so re-running this
-- migration is idempotent) and we skip legacy premium users (is_legacy=TRUE
-- means they already have permanent Pro and don't need a finite grant).
INSERT INTO public.premium_grants (user_id, months_granted, source, expires_at)
SELECT
  u.id,
  1,
  'launch_gift',
  NOW() + INTERVAL '30 days'
FROM auth.users u
LEFT JOIN public.premium_users pu ON pu.user_id = u.id AND pu.is_legacy = TRUE
WHERE pu.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.premium_grants pg
    WHERE pg.user_id = u.id AND pg.source = 'launch_gift'
  );

-- 3. The AFTER INSERT trigger fires per-row and calls update_granted_until,
-- which will sync each user's premium_users.granted_until to the max of
-- their active grants. No manual sync needed here.
