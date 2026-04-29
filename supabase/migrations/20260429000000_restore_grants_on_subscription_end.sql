-- =============================================
-- RESTORE REFERRAL GRANTS ON SUBSCRIPTION END
-- =============================================
-- Previously, when a Stripe subscription moved to canceled / unpaid /
-- incomplete_expired, sync_premium_from_subscription() deleted the
-- premium_users row and any deferred referral grants the user had earned
-- while subscribed were stranded with already-passed expires_at values.
--
-- Referral grants are now stacked on top of the active subscription period
-- (see supabase/functions/_shared/grant-expiry.ts), so they have valid
-- future expires_at dates. After the paid row is removed we call
-- update_granted_until() to recompute granted_until from any remaining
-- grants and re-create the premium_users row if applicable.
-- =============================================

CREATE OR REPLACE FUNCTION public.sync_premium_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Active OR trialing subscription -> mark as paid premium and clear any
  -- granted_until value (the user is now driven by the subscription, not a
  -- grant). Deferred grants remain in premium_grants and will be reapplied
  -- when the subscription ends.
  IF NEW.status IN ('active', 'trialing') THEN
    INSERT INTO public.premium_users (user_id, is_legacy, granted_until, created_at)
    VALUES (NEW.user_id, FALSE, NULL, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET is_legacy = FALSE,
          granted_until = NULL;

  -- Terminal cancellation states -> drop the paid premium row, then restore
  -- granted_until from any deferred referral / milestone / trial grants that
  -- are still in the future. update_granted_until() handles both the insert
  -- (if grants exist) and the no-op (if none do).
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    DELETE FROM public.premium_users
    WHERE user_id = NEW.user_id AND is_legacy = FALSE;

    PERFORM public.update_granted_until(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  RAISE NOTICE '✓ sync_premium_from_subscription() now restores granted_until from deferred grants on subscription end';
END $$;
