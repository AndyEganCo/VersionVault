-- =============================================
-- ADD STRIPE CUSTOMER ID TO USERS
-- =============================================
-- Persist stripe_customer_id on the user row so we can reuse the same
-- customer across repeated checkout attempts.
--
-- Background: create-checkout-session previously only looked for an existing
-- customer in the `subscriptions` table. That row is not created until
-- checkout.session.completed fires, so every click on "Upgrade" before the
-- user actually pays creates a brand new orphan Stripe customer.
-- =============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Lookup index — partial so it doesn't bloat with NULLs.
-- Unique because one Stripe customer should map to at most one app user.
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Backfill from existing subscription rows so paying users keep their customer ID.
UPDATE public.users u
SET stripe_customer_id = s.stripe_customer_id
FROM public.subscriptions s
WHERE u.id = s.user_id
  AND s.stripe_customer_id IS NOT NULL
  AND u.stripe_customer_id IS NULL;
