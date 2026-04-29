// Supabase Edge Function for admin-initiated premium grants.
// Grants N months of Pro to a user. Use for backfilling missed referrals,
// compensating for bugs, or gifting Pro time.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { computeGrantExpiry } from '../_shared/grant-expiry.ts'
import { addReferralCreditToCustomer } from '../_shared/customer-balance-credit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: unknown, status: number) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
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

    let userIdInput: unknown
    let emailInput: unknown
    let monthsInput: unknown
    try {
      const body = await req.json()
      userIdInput = body?.userId
      emailInput = body?.email
      monthsInput = body?.months
    } catch {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }

    const months = Number(monthsInput)
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return jsonResponse({ error: 'months must be an integer between 1 and 120' }, 400)
    }

    // Resolve target user: accept either userId or email.
    let targetUserId: string | null = null
    if (typeof userIdInput === 'string' && UUID_RE.test(userIdInput)) {
      targetUserId = userIdInput
    } else if (typeof emailInput === 'string' && emailInput.includes('@')) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .ilike('email', emailInput.trim())
        .maybeSingle()
      if (!userRow) return jsonResponse({ error: `No user found with email ${emailInput}` }, 404)
      targetUserId = userRow.id
    } else {
      return jsonResponse({ error: 'Provide either userId (UUID) or email' }, 400)
    }

    // Stack expiry on top of any existing paid subscription period or active
    // grant so the grant is meaningful if/when the user later goes from
    // free to paid (Checkout reads this via trial_end).
    const expiresAt = await computeGrantExpiry(supabase, targetUserId, months)

    const { data: grant, error: grantError } = await supabase
      .from('premium_grants')
      .insert({
        user_id: targetUserId,
        months_granted: months,
        source: 'admin_grant',
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (grantError) {
      console.error('Failed to insert grant:', grantError)
      return jsonResponse({ error: grantError.message }, 500)
    }

    // If the user already has a paid subscription, the grant is delivered as
    // a Stripe customer-balance credit applied to their next invoice — so the
    // renewal date stays put and Stripe shows "Active" rather than "trial".
    let stripeSync: unknown = { skipped: true, reason: 'no stripe key' }
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (stripeSecretKey) {
      try {
        const stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2023-10-16',
          httpClient: Stripe.createFetchHttpClient(),
        })
        stripeSync = await addReferralCreditToCustomer(stripe, supabase, targetUserId, months, 'admin_grant')
      } catch (err) {
        console.error('addReferralCreditToCustomer failed:', err)
        stripeSync = { error: (err as Error).message }
      }
    }

    console.log(`Admin ${caller.id} granted ${months}mo to ${targetUserId}`, stripeSync)
    return jsonResponse({ success: true, grant, stripeSync }, 200)
  } catch (error) {
    console.error('admin-grant-premium error:', error)
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})
