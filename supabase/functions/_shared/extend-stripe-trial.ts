// Push back the renewal date of a user's active Stripe subscription so it
// matches the latest premium_grants.expires_at for that user.
//
// Stripe's trial_end can be set to any future timestamp on an active
// subscription; the next invoice is then dated trial_end. We use it as our
// "free time" mechanism for both pre-checkout grants (in
// create-checkout-session) and post-checkout grants (here).
//
// Idempotent: if Stripe's current trial_end (or current_period_end if no
// trial) already matches or exceeds the target, we skip the API call.

import type Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

export interface ExtendResult {
  updated: boolean
  reason: string
  stripeSubscriptionId?: string
  newTrialEnd?: string
}

export async function extendStripeTrialToGrants(
  stripe: Stripe,
  supabase: any,
  userId: string,
): Promise<ExtendResult> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, current_period_end, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return { updated: false, reason: 'no active subscription' }
  }

  const { data: latestGrant } = await supabase
    .from('premium_grants')
    .select('expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestGrant?.expires_at) {
    return { updated: false, reason: 'no future grants', stripeSubscriptionId: sub.stripe_subscription_id }
  }

  const targetMs = new Date(latestGrant.expires_at).getTime()
  const currentEndMs = sub.current_period_end ? new Date(sub.current_period_end).getTime() : 0

  if (targetMs <= currentEndMs) {
    return { updated: false, reason: 'grants do not extend past current period', stripeSubscriptionId: sub.stripe_subscription_id }
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
  const stripeTrialEndMs = stripeSub.trial_end ? stripeSub.trial_end * 1000 : 0
  const stripeCurrentEndMs = (stripeSub as any).current_period_end ? (stripeSub as any).current_period_end * 1000 : 0
  const stripeAnchorMs = Math.max(stripeTrialEndMs, stripeCurrentEndMs)

  if (targetMs <= stripeAnchorMs) {
    return { updated: false, reason: 'stripe already past target', stripeSubscriptionId: sub.stripe_subscription_id }
  }

  const trialEndUnix = Math.floor(targetMs / 1000)
  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    trial_end: trialEndUnix,
    proration_behavior: 'none',
  })

  return {
    updated: true,
    reason: 'pushed trial_end forward',
    stripeSubscriptionId: sub.stripe_subscription_id,
    newTrialEnd: new Date(trialEndUnix * 1000).toISOString(),
  }
}
