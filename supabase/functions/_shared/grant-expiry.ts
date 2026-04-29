// Compute the expiry timestamp for a new premium_grants row so that referral
// months stack on top of any existing paid subscription period and any other
// active free grants — never overlapping with paid Pro time.
//
// Anchor = MAX(now, premium_users.granted_until, subscriptions.current_period_end
//              for active/trialing subs)
// expires_at = anchor + monthsGranted months

export async function computeGrantExpiry(
  supabase: any,
  userId: string,
  monthsGranted: number,
): Promise<string> {
  const now = new Date()
  let anchor = now

  const { data: premiumRow } = await supabase
    .from('premium_users')
    .select('granted_until')
    .eq('user_id', userId)
    .maybeSingle()

  if (premiumRow?.granted_until) {
    const grantedUntil = new Date(premiumRow.granted_until)
    if (grantedUntil > anchor) anchor = grantedUntil
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
