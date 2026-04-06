// Supabase Edge Function for processing referral rewards
// Called after email verification to grant rewards to both referrer and friend
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

      await checkMilestones(supabase, referrerId, totalReferrals ?? 0)

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

async function checkMilestones(supabase: any, referrerId: string, totalReferrals: number) {
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
    }
  }
}
