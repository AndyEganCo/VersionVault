// Compute the expiry timestamp for a new premium_grants row so that referral
// and admin grants stack on top of any existing paid subscription period and
// any other future grants — never overlapping with paid Pro time.
//
// Anchor = MAX(now,
//              premium_grants.MAX(expires_at) where expires_at > now,
//              subscriptions.current_period_end for active/trialing subs)
// expires_at = anchor + monthsGranted months
//
// We query premium_grants directly rather than premium_users.granted_until
// because granted_until is intentionally NULL while a user has an active
// paid subscription, even though deferred grants may still be sitting in
// premium_grants waiting to take over after the subscription ends.

export async function computeGrantExpiry(
  supabase: any,
  userId: string,
  monthsGranted: number,
): Promise<string> {
  const now = new Date()
  let anchor = now

  const { data: latestGrant } = await supabase
    .from('premium_grants')
    .select('expires_at')
    .eq('user_id', userId)
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestGrant?.expires_at) {
    const grantExpiry = new Date(latestGrant.expires_at)
    if (grantExpiry > anchor) anchor = grantExpiry
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_end, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub?.current_period_end) {
    const periodEnd = new Date(sub.current_period_end)
    if (periodEnd > anchor) anchor = periodEnd
  }

  const expiry = new Date(anchor)
  expiry.setMonth(expiry.getMonth() + monthsGranted)
  return expiry.toISOString()
}
