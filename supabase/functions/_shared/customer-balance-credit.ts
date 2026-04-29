// Apply a referral/admin grant to a user with an active Stripe subscription
// by adding a negative customer balance instead of pushing trial_end.
//
// Why: trial_end is the only Stripe construct that defers the next invoice
// date, but it labels the subscription as "Free trial" in the dashboard,
// portal, and emails. For users who already paid (and so are not actually
// on a trial), we want a clean "Active" status. customer.balance is signed:
// negative balance = credit owed to the customer. Stripe automatically
// applies it to the next invoice up to the invoice subtotal.
//
// Per-month credit is derived from the subscription's actual yearly price
// so the math stays correct if pricing changes. We round to the nearest
// cent.

import type Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

export interface CreditResult {
  applied: boolean
  reason: string
  customerId?: string
  amountCents?: number
  description?: string
}

export async function addReferralCreditToCustomer(
  stripe: Stripe,
  supabase: any,
  userId: string,
  monthsGranted: number,
  source: string,
): Promise<CreditResult> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub?.stripe_customer_id || !sub?.stripe_subscription_id) {
    return { applied: false, reason: 'no active subscription' }
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
    expand: ['items.data.price'],
  })
  const item = stripeSub.items?.data?.[0]
  const yearlyAmountCents = (item?.price as any)?.unit_amount
  if (!yearlyAmountCents || yearlyAmountCents <= 0) {
    return { applied: false, reason: 'subscription has no priced item', customerId: sub.stripe_customer_id }
  }

  const monthlyCents = Math.round(yearlyAmountCents / 12)
  const creditCents = monthlyCents * monthsGranted
  if (creditCents <= 0) {
    return { applied: false, reason: 'credit rounds to 0', customerId: sub.stripe_customer_id }
  }

  const description = `${monthsGranted} ${monthsGranted === 1 ? 'month' : 'months'} (${source})`
  await stripe.customers.createBalanceTransaction(sub.stripe_customer_id, {
    amount: -creditCents,
    currency: (stripeSub.currency || 'usd').toLowerCase(),
    description: `Referral credit: ${description}`,
  } as any)

  return {
    applied: true,
    reason: 'credit added to customer balance',
    customerId: sub.stripe_customer_id,
    amountCents: creditCents,
    description,
  }
}
