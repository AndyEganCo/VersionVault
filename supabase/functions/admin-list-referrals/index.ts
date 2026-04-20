// Supabase Edge Function for admin-only referral listing.
// Uses the service role to bypass RLS so admins can see all referrals across
// all users, aggregated by referrer for the leaderboard on the admin page.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

interface ReferralRow {
  referrer_id: string
  status: string
  created_at: string
}

interface LeaderboardRow {
  referrer_id: string
  referrer_email: string
  code: string | null
  total: number
  verified: number
  paid: number
  last_referral_at: string | null
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

    const { data: referrals, error: refError } = await supabase
      .from('referrals')
      .select('referrer_id, status, created_at')
      .order('created_at', { ascending: false })

    if (refError) {
      console.error('Failed to read referrals:', refError)
      return jsonResponse({ error: refError.message }, 500)
    }

    const referralList: ReferralRow[] = referrals || []

    const byReferrer = new Map<string, LeaderboardRow>()
    for (const r of referralList) {
      const existing = byReferrer.get(r.referrer_id)
      if (existing) {
        existing.total += 1
        if (r.status === 'verified' || r.status === 'paid') existing.verified += 1
        if (r.status === 'paid') existing.paid += 1
        if (!existing.last_referral_at || r.created_at > existing.last_referral_at) {
          existing.last_referral_at = r.created_at
        }
      } else {
        byReferrer.set(r.referrer_id, {
          referrer_id: r.referrer_id,
          referrer_email: '',
          code: null,
          total: 1,
          verified: r.status === 'verified' || r.status === 'paid' ? 1 : 0,
          paid: r.status === 'paid' ? 1 : 0,
          last_referral_at: r.created_at,
        })
      }
    }

    const referrerIds = Array.from(byReferrer.keys())

    if (referrerIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email')
        .in('id', referrerIds)

      if (usersError) {
        console.error('Failed to read users:', usersError)
      } else {
        for (const u of usersData || []) {
          const row = byReferrer.get(u.id)
          if (row) row.referrer_email = u.email
        }
      }

      const { data: codesData, error: codesError } = await supabase
        .from('referral_codes')
        .select('user_id, code')
        .in('user_id', referrerIds)

      if (codesError) {
        console.error('Failed to read referral codes:', codesError)
      } else {
        for (const c of codesData || []) {
          const row = byReferrer.get(c.user_id)
          if (row) row.code = c.code
        }
      }
    }

    const rows = Array.from(byReferrer.values()).sort((a, b) => b.total - a.total)

    const stats = {
      activeReferrers: rows.length,
      totalReferrals: referralList.length,
      verifiedReferrals: referralList.filter(r => r.status === 'verified' || r.status === 'paid').length,
      paidReferrals: referralList.filter(r => r.status === 'paid').length,
    }

    return jsonResponse({ rows, stats }, 200)
  } catch (error) {
    console.error('admin-list-referrals error:', error)
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})
