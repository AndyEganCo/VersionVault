// Supabase Edge Function for admin-initiated referral recording.
// Creates a referrer→referred_user relationship in the `referrals` table and
// (optionally) grants both sides the normal signup rewards. Use to backfill
// referrals that didn't process during signup.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIGNUP_REWARD_MONTHS = 1

function jsonResponse(body: unknown, status: number) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function resolveUser(
  supabase: any,
  id: unknown,
  email: unknown,
  label: string,
): Promise<{ id: string } | { error: string }> {
  if (typeof id === 'string' && UUID_RE.test(id)) return { id }
  if (typeof email === 'string' && email.includes('@')) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle()
    if (!data) return { error: `No user found with ${label} email ${email}` }
    return { id: data.id }
  }
  return { error: `Provide ${label}Id (UUID) or ${label}Email` }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) return jsonResponse({ error: 'Invalid authentication' }, 401)

    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()
    if (!adminRow) return jsonResponse({ error: 'Forbidden' }, 403)

    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }

    const grantRewards = body.grantRewards !== false // default true

    const referrer = await resolveUser(supabase, body.referrerId, body.referrerEmail, 'referrer')
    if ('error' in referrer) return jsonResponse({ error: referrer.error }, 400)

    const referred = await resolveUser(supabase, body.referredUserId, body.referredEmail, 'referred')
    if ('error' in referred) return jsonResponse({ error: referred.error }, 400)

    if (referrer.id === referred.id) {
      return jsonResponse({ error: 'Self-referral not allowed' }, 400)
    }

    // Upsert the referral record.
    const { data: referral, error: refError } = await supabase
      .from('referrals')
      .upsert({
        referrer_id: referrer.id,
        referred_user_id: referred.id,
        status: 'verified',
        signup_rewarded: grantRewards,
      }, { onConflict: 'referrer_id,referred_user_id' })
      .select()
      .single()

    if (refError) {
      console.error('Failed to upsert referral:', refError)
      return jsonResponse({ error: refError.message }, 500)
    }

    if (grantRewards) {
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + SIGNUP_REWARD_MONTHS)
      const expiresAt = expiry.toISOString()

      const { error: grantError } = await supabase.from('premium_grants').insert([
        {
          user_id: referrer.id,
          months_granted: SIGNUP_REWARD_MONTHS,
          source: 'referral_signup',
          referral_id: referral.id,
          expires_at: expiresAt,
        },
        {
          user_id: referred.id,
          months_granted: SIGNUP_REWARD_MONTHS,
          source: 'referral_signup',
          referral_id: referral.id,
          expires_at: expiresAt,
        },
      ])
      if (grantError) {
        console.error('Failed to grant referral rewards:', grantError)
        return jsonResponse({ error: `Referral recorded but grant failed: ${grantError.message}` }, 500)
      }
    }

    console.log(`✅ Admin ${caller.id} recorded referral ${referrer.id} → ${referred.id} (rewards=${grantRewards})`)
    return jsonResponse({ success: true, referral, grantedRewards: grantRewards }, 200)
  } catch (error) {
    console.error('admin-record-referral error:', error)
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})
