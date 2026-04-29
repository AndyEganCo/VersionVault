// Supabase Edge Function for processing referral rewards
// Called after email verification to grant rewards to both referrer and friend
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import { throttledResendSend } from '../_shared/resend-throttle.ts'
import { computeGrantExpiry } from '../_shared/grant-expiry.ts'

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
      // Idempotency: if a signup-rewarded referral already exists for this
      // (referrer, referred) pair, return success without re-granting. This
      // matters because the client now invokes us from multiple places
      // (post-signUp in AuthContext, SIGNED_IN state change, the /auth/callback
      // page) — any of which could fire for the same user on the same flow.
      const { data: existing } = await supabase
        .from('referrals')
        .select('id, signup_rewarded')
        .eq('referrer_id', referrerId)
        .eq('referred_user_id', referredUserId)
        .maybeSingle()

      if (existing?.signup_rewarded) {
        console.log(`⚠️  Signup referral already processed: referrer=${referrerId}, friend=${referredUserId}`)
        return new Response(
          JSON.stringify({ success: true, alreadyProcessed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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

      // Grant reward to referrer — stack expiry on top of any existing paid
      // subscription or active grant so free months never overlap paid time.
      const referrerExpiry = await computeGrantExpiry(supabase, referrerId, SIGNUP_REWARD_MONTHS)
      await supabase.from('premium_grants').insert({
        user_id: referrerId,
        months_granted: SIGNUP_REWARD_MONTHS,
        source: 'referral_signup',
        referral_id: referral.id,
        expires_at: referrerExpiry,
      })

      // Grant reward to referred friend (two-sided)
      const friendExpiry = await computeGrantExpiry(supabase, referredUserId, FRIEND_REWARD_MONTHS)
      await supabase.from('premium_grants').insert({
        user_id: referredUserId,
        months_granted: FRIEND_REWARD_MONTHS,
        source: 'referral_signup',
        referral_id: referral.id,
        expires_at: friendExpiry,
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
        await sendReferralRewardEmail(resend, refUser.user.email, referrerId, 'signup', SIGNUP_REWARD_MONTHS, totalReferrals ?? 0, milestoneMonths)
      }
      if (friendUser?.user?.email) {
        await sendReferralRewardEmail(resend, friendUser.user.email, referredUserId, 'friend', FRIEND_REWARD_MONTHS, 0, 0)
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
        const expiry = await computeGrantExpiry(supabase, referrerId, PAID_REWARD_MONTHS)
        await supabase.from('premium_grants').insert({
          user_id: referrerId,
          months_granted: PAID_REWARD_MONTHS,
          source: 'referral_paid',
          referral_id: referral.id,
          expires_at: expiry,
        })

        const { data: refUser } = await supabase.auth.admin.getUserById(referrerId)
        if (refUser?.user?.email) {
          await sendReferralRewardEmail(resend, refUser.user.email, referrerId, 'paid', PAID_REWARD_MONTHS, 0, 0)
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
      const expiry = await computeGrantExpiry(supabase, referrerId, milestone.months)
      await supabase.from('premium_grants').insert({
        user_id: referrerId,
        months_granted: milestone.months,
        source: 'milestone_bonus',
        expires_at: expiry,
      })
      console.log(`🎉 Milestone bonus: ${milestone.months} months for ${milestone.threshold} referrals`)
      bonusMonths += milestone.months
    }
  }
  return bonusMonths
}

function renderShell(label: string, userId: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
    <!-- Header -->
    <div style="padding: 32px 24px 24px 24px; border-bottom: 1px solid #262626;">
      <a href="${VERSIONVAULT_URL}" style="text-decoration: none;">
        <div style="font-size: 20px; font-weight: 600; color: #ffffff; font-family: monospace;">
          <span style="color: #a3a3a3;">&gt;_</span> VersionVault
        </div>
      </a>
      <div style="font-size: 14px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">
        ${label}
      </div>
    </div>

    ${bodyHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="${VERSIONVAULT_URL}/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">&bull;</span>
        <a href="${VERSIONVAULT_URL}/unsubscribe?uid=${userId}" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">&bull;</span>
        <a href="${VERSIONVAULT_URL}/dashboard" style="color: #a3a3a3; text-decoration: underline;">Open Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault &bull; Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">&copy; ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`
}

async function sendReferralRewardEmail(
  resend: Resend | null,
  email: string,
  userId: string,
  type: 'signup' | 'friend' | 'paid',
  months: number,
  totalReferrals: number,
  bonusMonths: number
) {
  const labels = {
    signup: 'REFERRAL REWARD',
    friend: 'WELCOME GIFT',
    paid: 'REFERRAL UPGRADE',
  }
  const subjects = {
    signup: `You earned ${months} month${months === 1 ? '' : 's'} of VersionVault Pro`,
    friend: `Welcome — enjoy ${months} month${months === 1 ? '' : 's'} of Pro on us`,
    paid: `Your friend upgraded — ${months} more months of Pro for you`,
  }
  const headlines = {
    signup: `You just earned ${months} month${months === 1 ? '' : 's'} of Pro`,
    friend: `You've got ${months} free month${months === 1 ? '' : 's'} of Pro`,
    paid: `Your referral became a paying subscriber`,
  }
  const bodies = {
    signup: `A friend signed up with your referral code. You've been credited <strong style="color: #ffffff;">${months} month${months === 1 ? '' : 's'}</strong> of VersionVault Pro. You now have <strong style="color: #ffffff;">${totalReferrals}</strong> successful referral${totalReferrals === 1 ? '' : 's'} total.${bonusMonths > 0 ? ` You also unlocked a <strong style="color: #ffffff;">${bonusMonths}-month milestone bonus</strong>!` : ''}`,
    friend: `Welcome to VersionVault! Because you joined through a friend, you're getting <strong style="color: #ffffff;">${months} month${months === 1 ? '' : 's'} of Pro</strong> on the house — unlimited tracked apps and all notification frequencies.`,
    paid: `Great news — a friend you referred just upgraded to Pro. You've been credited <strong style="color: #ffffff;">${months} bonus month${months === 1 ? '' : 's'}</strong> of VersionVault Pro.`,
  }

  const body = `
    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">${headlines[type]}</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        ${bodies[type]}
      </div>
    </div>

    <!-- Reward card -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #2563eb; margin-bottom: 4px;">+${months} month${months === 1 ? '' : 's'}</div>
        <div style="font-size: 13px; color: #a3a3a3;">of Pro added to your account</div>
      </div>
    </div>

    <!-- CTAs -->
    <div style="padding: 0 24px 32px 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/dashboard" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Go to dashboard</a>
      <a href="${VERSIONVAULT_URL}/user/referrals" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #262626; border: 1px solid #404040; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Invite more friends</a>
    </div>
  `

  const html = renderShell(labels[type], userId, body)

  const text = `>_ VersionVault - ${labels[type]}\n\n${headlines[type]}\n\n${bodies[type].replace(/<[^>]+>/g, '')}\n\nDashboard: ${VERSIONVAULT_URL}/dashboard\nInvite more: ${VERSIONVAULT_URL}/user/referrals\n\n--\nVersionVault\nUnsubscribe: ${VERSIONVAULT_URL}/unsubscribe?uid=${userId}\n`

  if (!resend) {
    console.log(`📧 [dry-run] referral ${type} → ${email} (+${months}mo)`)
    return
  }
  const { error } = await throttledResendSend(resend, { from: VERSIONVAULT_FROM, to: email, subject: subjects[type], html, text })
  if (error) console.error(`❌ referral ${type} send failed for ${email}:`, error)
  else console.log(`✅ Sent referral ${type} email to ${email}`)
}
