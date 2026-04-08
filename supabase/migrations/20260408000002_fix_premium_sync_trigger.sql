-- =============================================
-- FIX PREMIUM SYNC TRIGGER
-- =============================================
-- Updates sync_premium_from_subscription() to:
--   1. Treat 'trialing' as a premium status (Stripe checkout sometimes lands
--      in trialing before active depending on the price configuration).
--   2. Clear granted_until on conversion so trial users who pay are no longer
--      shown as "trial expiring" in the UI.
--   3. Clean up premium_users when a subscription becomes incomplete_expired
--      (abandoned signups).
-- =============================================

CREATE OR REPLACE FUNCTION public.sync_premium_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Active OR trialing subscription -> mark as paid premium and clear any trial grant
  IF NEW.status IN ('active', 'trialing') THEN
    INSERT INTO public.premium_users (user_id, is_legacy, granted_until, created_at)
    VALUES (NEW.user_id, FALSE, NULL, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET is_legacy = FALSE,
          granted_until = NULL;

  -- Terminal cancellation states -> drop the paid premium row
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    DELETE FROM public.premium_users
    WHERE user_id = NEW.user_id AND is_legacy = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✓ sync_premium_from_subscription() updated to handle trialing/incomplete_expired and clear granted_until on conversion';
END $$;
