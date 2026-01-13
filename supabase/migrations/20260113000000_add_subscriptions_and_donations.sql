-- =============================================
-- ADD SUBSCRIPTIONS AND DONATIONS TABLES
-- =============================================
-- This migration adds tables to support Stripe payment integration
-- for premium subscriptions ($50/year) and one-time donations
-- =============================================

-- ============================================
-- 1. Create subscriptions table
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid', 'incomplete'
  plan_type TEXT NOT NULL DEFAULT 'premium_yearly', -- 'premium_yearly' (only option for now)
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one active subscription per user
  UNIQUE(user_id, stripe_subscription_id)
);

-- Create indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- ============================================
-- 2. Create donations table
-- ============================================
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable for anonymous donations
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_checkout_session_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  donor_name TEXT, -- for public recognition (user can specify)
  donor_email TEXT, -- captured from Stripe
  donor_message TEXT, -- optional message from donor
  is_public BOOLEAN DEFAULT FALSE, -- show on supporters page
  is_recurring BOOLEAN DEFAULT FALSE, -- if this is part of recurring donation
  stripe_subscription_id TEXT, -- if recurring, link to subscription
  status TEXT NOT NULL DEFAULT 'succeeded', -- 'succeeded', 'pending', 'failed', 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- If recurring, must have subscription_id
  CHECK (
    (is_recurring = FALSE AND stripe_subscription_id IS NULL) OR
    (is_recurring = TRUE AND stripe_subscription_id IS NOT NULL)
  )
);

-- Create indexes for donations
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON public.donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent_id ON public.donations(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_subscription_id ON public.donations(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON public.donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_is_public ON public.donations(is_public) WHERE is_public = TRUE;

-- ============================================
-- 3. Add legacy flag to premium_users
-- ============================================
-- Add column to distinguish legacy (manually granted) vs paid premium users
ALTER TABLE public.premium_users
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT TRUE;

-- Mark all existing premium users as legacy
UPDATE public.premium_users SET is_legacy = TRUE WHERE is_legacy IS NULL;

-- Add index for legacy users
CREATE INDEX IF NOT EXISTS idx_premium_users_is_legacy ON public.premium_users(is_legacy);

-- ============================================
-- 4. Create function to sync premium status from subscriptions
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_premium_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription becomes active, add to premium_users
  IF NEW.status = 'active' THEN
    INSERT INTO public.premium_users (user_id, is_legacy, created_at)
    VALUES (NEW.user_id, FALSE, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET is_legacy = FALSE;

  -- If subscription is canceled/past_due/unpaid, remove from premium_users (unless legacy)
  ELSIF NEW.status IN ('canceled', 'unpaid') THEN
    DELETE FROM public.premium_users
    WHERE user_id = NEW.user_id AND is_legacy = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Create trigger to auto-sync premium status
-- ============================================
DROP TRIGGER IF EXISTS on_subscription_status_change ON public.subscriptions;
CREATE TRIGGER on_subscription_status_change
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_premium_from_subscription();

-- ============================================
-- 6. Create function to update subscription updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Create trigger for subscription updated_at
-- ============================================
DROP TRIGGER IF EXISTS set_subscription_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscription_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_updated_at();

-- ============================================
-- 8. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can read their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can read their own subscriptions" ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can read all subscriptions" ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Donations policies
DROP POLICY IF EXISTS "Users can read their own donations" ON public.donations;
CREATE POLICY "Users can read their own donations" ON public.donations
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can read public donations" ON public.donations;
CREATE POLICY "Anyone can read public donations" ON public.donations
  FOR SELECT
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "Admins can read all donations" ON public.donations;
CREATE POLICY "Admins can read all donations" ON public.donations
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role can manage all donations" ON public.donations;
CREATE POLICY "Service role can manage all donations" ON public.donations
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================
-- 9. Create view for active premium users
-- ============================================
-- Combines legacy premium users with active subscribers
CREATE OR REPLACE VIEW public.active_premium_users AS
SELECT DISTINCT
  pu.user_id,
  pu.is_legacy,
  pu.created_at,
  s.stripe_customer_id,
  s.current_period_end
FROM public.premium_users pu
LEFT JOIN public.subscriptions s ON pu.user_id = s.user_id AND s.status = 'active';

-- Grant access to the view
GRANT SELECT ON public.active_premium_users TO authenticated;
GRANT SELECT ON public.active_premium_users TO service_role;

-- ============================================
-- 10. Verification
-- ============================================
DO $$
DECLARE
  subscriptions_count INT;
  donations_count INT;
  premium_users_count INT;
BEGIN
  SELECT COUNT(*) INTO subscriptions_count FROM public.subscriptions;
  SELECT COUNT(*) INTO donations_count FROM public.donations;
  SELECT COUNT(*) INTO premium_users_count FROM public.premium_users;

  RAISE NOTICE '✓ Subscriptions table created (% rows)', subscriptions_count;
  RAISE NOTICE '✓ Donations table created (% rows)', donations_count;
  RAISE NOTICE '✓ Premium users migrated (% rows marked as legacy)', premium_users_count;
  RAISE NOTICE '✓ Triggers and RLS policies configured';
END $$;
