-- Referral system for freemium model
-- Supports two-sided rewards: referrer and friend both benefit

-- Referral codes (one per user)
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track who referred whom
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'paid')),
  signup_rewarded BOOLEAN DEFAULT FALSE,
  paid_rewarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (referrer_id, referred_user_id)
);

-- Premium time grants from referrals and welcome trial
CREATE TABLE public.premium_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  months_granted INTEGER NOT NULL CHECK (months_granted > 0),
  source TEXT NOT NULL CHECK (source IN ('referral_signup', 'referral_paid', 'milestone_bonus', 'welcome_trial')),
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Add granted_until to premium_users for referral/trial premium
ALTER TABLE public.premium_users
ADD COLUMN IF NOT EXISTS granted_until TIMESTAMPTZ DEFAULT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes (code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON public.referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals (referred_user_id);
CREATE INDEX IF NOT EXISTS idx_premium_grants_user ON public.premium_grants (user_id);
CREATE INDEX IF NOT EXISTS idx_premium_grants_expires ON public.premium_grants (expires_at);
CREATE INDEX IF NOT EXISTS idx_premium_users_granted ON public.premium_users (granted_until)
  WHERE granted_until IS NOT NULL;

-- RLS Policies
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

-- Referral codes: users can read their own
CREATE POLICY "Users can read their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Referral codes: service role can insert (via edge function)
CREATE POLICY "Service role can manage referral codes"
  ON public.referral_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Referrals: users can see referrals they made or received
CREATE POLICY "Users can read their referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "Service role can manage referrals"
  ON public.referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Premium grants: users can see their own grants
CREATE POLICY "Users can read their own grants"
  ON public.premium_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage grants"
  ON public.premium_grants FOR ALL
  USING (auth.role() = 'service_role');

-- Function to calculate and update granted_until for a user
CREATE OR REPLACE FUNCTION public.update_granted_until(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  max_expiry TIMESTAMPTZ;
BEGIN
  SELECT MAX(expires_at) INTO max_expiry
  FROM public.premium_grants
  WHERE user_id = p_user_id
  AND expires_at > NOW();

  IF max_expiry IS NOT NULL THEN
    INSERT INTO public.premium_users (user_id, is_legacy, granted_until)
    VALUES (p_user_id, FALSE, max_expiry)
    ON CONFLICT (user_id) DO UPDATE
    SET granted_until = max_expiry;
  ELSE
    -- Only clear granted_until, don't remove the row if they have a subscription
    UPDATE public.premium_users
    SET granted_until = NULL
    WHERE user_id = p_user_id
    AND is_legacy = FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update granted_until when grants change
CREATE OR REPLACE FUNCTION public.trigger_update_granted_until()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_granted_until(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.update_granted_until(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_premium_grant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.premium_grants
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_granted_until();
