// Supabase Edge Function for processing referral rewards
// Called after email verification to grant rewards to both referrer and friend
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSIONVAULT_FROM = 'VersionVault <rewards@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

// Reward configuration
const SIGNUP_REWARD_MONTHS = 1    // Referrer gets 1 month when friend signs up
const FRIEND_REWARD_MONTHS = 1    // Friend gets 1 month when they sign up via referral
const PAID_REWARD_MONTHS = 3      // Referrer gets 3 months when friend becomes paying subscriber
const MILESTONE_5_BONUS = 2       // +2 months at 5 referrals
const MILESTONE_10_BONUS = 3      // +3 months at 10 referrals
const MILESTONE_25_BONUS = 6      // +6 months at 25 referrals
const MAX_REFERRALS_PER_MONTH = 50

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resend = resendApiKey ? new Resend(resendApiKey) : null

    const { referredUserId, referralCode, type } = await req.json()

    if (!referredUserId || !referralCode) {
      return new Response(
        JSON.stringify({ error: 'Missing referredUserId or referralCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up referrer from code
    const { data: codeData } = await supabase
      .from('referral_codes')
      .select('user_id')
      .eq('code', referralCode.toUpperCase())
      .maybeSingle()

    if (!codeData) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const referrerId = codeData.user_id

    // Anti-abuse: no self-referral
    if (referrerId === referredUserId) {
      return new Response(
        JSON.stringify({ error: 'Self-referral not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Anti-abuse: rate limit per month
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    const { count: recentCount } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .gte('created_at', monthAgo.toISOString())

    if ((recentCount ?? 0) >= MAX_REFERRALS_PER_MONTH) {
      return new Response(
        JSON.stringify({ error: 'Monthly referral limit reached' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (type === 'signup') {
      // Create or update referral record
      const { data: referral, error: refError } = await supabase
        .from('referrals')
        .upsert({
          referrer_id: referrerId,
          referred_user_id: referredUserId,
          status: 'verified',
          signup_rewarded: true,
        }, { onConflict: 'referrer_id,referred_user_id' })
        .select()
        .single()

      if (refError) throw refError

      // Grant reward to referrer
      const referrerExpiry = new Date()
      referrerExpiry.setMonth(referrerExpiry.getMonth() + SIGNUP_REWARD_MONTHS)
      await supabase.from('premium_grants').insert({
        user_id: referrerId,
        months_granted: SIGNUP_REWARD_MONTHS,
        source: 'referral_signup',
        referral_id: referral.id,
        expires_at: referrerExpiry.toISOString(),
      })

      // Grant reward to referred friend (two-sided)
      const friendExpiry = new Date()
      friendExpiry.setMonth(friendExpiry.getMonth() + FRIEND_REWARD_MONTHS)
      await supabase.from('premium_grants').insert({
        user_id: referredUserId,
        months_granted: FRIEND_REWARD_MONTHS,
        source: 'referral_signup',
        referral_id: referral.id,
        expires_at: friendExpiry.toISOString(),
      })

      // Check milestone bonuses for referrer
      const { count: totalReferrals } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', referrerId)
        .in('status', ['verified', 'paid'])

      const milestoneMonths = await checkMilestones(supabase, referrerId, totalReferrals ?? 0)

      // Notify both sides
      const [{ data: refUser }, { data: friendUser }] = await Promise.all([
        supabase.auth.admin.getUserById(referrerId),
        supabase.auth.admin.getUserById(referredUserId),
      ])
      if (refUser?.user?.email) {
        await sendReferralRewardEmail(resend, refUser.user.email, 'signup', SIGNUP_REWARD_MONTHS, totalReferrals ?? 0, milestoneMonths)
      }
      if (friendUser?.user?.email) {
        await sendReferralRewardEmail(resend, friendUser.user.email, 'friend', FRIEND_REWARD_MONTHS, 0, 0)
      }

      console.log(`✅ Signup referral processed: referrer=${referrerId}, friend=${referredUserId}`)

    } else if (type === 'paid') {
      // Update referral status to paid
      const { data: referral } = await supabase
        .from('referrals')
        .update({ status: 'paid', paid_rewarded: true })
        .eq('referrer_id', referrerId)
        .eq('referred_user_id', referredUserId)
        .select()
        .single()

      if (referral) {
        // Grant paid conversion reward to referrer
        const expiry = new Date()
        expiry.setMonth(expiry.getMonth() + PAID_REWARD_MONTHS)
        await supabase.from('premium_grants').insert({
          user_id: referrerId,
          months_granted: PAID_REWARD_MONTHS,
          source: 'referral_paid',
          referral_id: referral.id,
          expires_at: expiry.toISOString(),
        })

        const { data: refUser } = await supabase.auth.admin.getUserById(referrerId)
        if (refUser?.user?.email) {
          await sendReferralRewardEmail(resend, refUser.user.email, 'paid', PAID_REWARD_MONTHS, 0, 0)
        }
      }

      console.log(`✅ Paid referral processed: referrer=${referrerId}, subscriber=${referredUserId}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing referral:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function checkMilestones(supabase: any, referrerId: string, totalReferrals: number): Promise<number> {
  // Check which milestones have already been granted
  const { data: existingMilestones } = await supabase
    .from('premium_grants')
    .select('months_granted')
    .eq('user_id', referrerId)
    .eq('source', 'milestone_bonus')

  const grantedMonths = new Set((existingMilestones || []).map((g: any) => g.months_granted))

  const milestones = [
    { threshold: 5, months: MILESTONE_5_BONUS },
    { threshold: 10, months: MILESTONE_10_BONUS },
    { threshold: 25, months: MILESTONE_25_BONUS },
  ]

  let bonusMonths = 0
  for (const milestone of milestones) {
    if (totalReferrals >= milestone.threshold && !grantedMonths.has(milestone.months)) {
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + milestone.months)
      await supabase.from('premium_grants').insert({
        user_id: referrerId,
        months_granted: milestone.months,
        source: 'milestone_bonus',
        expires_at: expiry.toISOString(),
      })
      console.log(`🎉 Milestone bonus: ${milestone.months} months for ${milestone.threshold} referrals`)
      bonusMonths += milestone.months
    }
  }
  return bonusMonths
}

async function sendReferralRewardEmail(
  resend: Resend | null,
  email: string,
  type: 'signup' | 'friend' | 'paid',
  months: number,
  totalReferrals: number,
  bonusMonths: number
) {
  const subjects = {
    signup: `🎉 You earned ${months} month${months === 1 ? '' : 's'} of VersionVault Pro`,
    friend: `Welcome! Enjoy ${months} month${months === 1 ? '' : 's'} of VersionVault Pro on us`,
    paid: `🚀 Your friend upgraded! ${months} more months of Pro for you`,
  }
  const headlines = {
    signup: `You just earned ${months} month${months === 1 ? '' : 's'} of Pro`,
    friend: `You've got ${months} free month${months === 1 ? '' : 's'} of Pro`,
    paid: `Your referral became a paying subscriber!`,
  }
  const bodies = {
    signup: `A friend signed up with your referral code. You've been credited <strong>${months} month${months === 1 ? '' : 's'}</strong> of VersionVault Pro. You now have <strong>${totalReferrals}</strong> successful referral${totalReferrals === 1 ? '' : 's'} total.${bonusMonths > 0 ? ` You also unlocked a <strong>${bonusMonths}-month milestone bonus</strong>!` : ''}`,
    friend: `Welcome to VersionVault! Because you joined through a friend, you're getting <strong>${months} month${months === 1 ? '' : 's'} of Pro</strong> on the house — unlimited tracked apps and all notification frequencies.`,
    paid: `Great news — a friend you referred just upgraded to Pro. You've been credited <strong>${months} bonus months</strong> of VersionVault Pro.`,
  }

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;">
    <h1 style="font-size:24px;margin:0 0 16px;">${headlines[type]}</h1>
    <p>${bodies[type]}</p>
    <p style="margin:24px 0;">
      <a href="${VERSIONVAULT_URL}/dashboard" style="background:#0f172a;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Go to dashboard</a>
    </p>
    <p style="font-size:12px;color:#64748b;margin-top:32px;">VersionVault · <a href="${VERSIONVAULT_URL}/unsubscribe" style="color:#64748b;">Unsubscribe</a></p>
  </body></html>`

  const text = `${headlines[type]}\n\n${bodies[type].replace(/<[^>]+>/g, '')}\n\n${VERSIONVAULT_URL}/dashboard\n`

  if (!resend) {
    console.log(`📧 [dry-run] referral ${type} → ${email} (+${months}mo)`)
    return
  }
  const { error } = await resend.emails.send({ from: VERSIONVAULT_FROM, to: email, subject: subjects[type], html, text })
  if (error) console.error(`❌ referral ${type} send failed for ${email}:`, error)
  else console.log(`✅ Sent referral ${type} email to ${email}`)
}
