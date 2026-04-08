// Supabase Edge Function: get live newsletter audience stats from Resend
// Returns the count of contacts in the configured Resend audience, broken
// down into total / subscribers / unsubscribers. Used by the admin
// Newsletter Compose page so the displayed count matches what Resend
// will actually deliver to.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResendContact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  created_at: string
  unsubscribed: boolean
}

interface ResendListResponse {
  object: 'list'
  data: ResendContact[]
}

interface AudienceStats {
  totalContacts: number
  subscribers: number
  unsubscribers: number
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to get-resend-audience-stats`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const audienceId = Deno.env.get('RESEND_AUDIENCE_ID')

    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!audienceId) {
      console.error('❌ Missing RESEND_AUDIENCE_ID')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin-only via JWT
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: adminData } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (!adminData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Admin user ${user.id} authorized; fetching audience ${audienceId}`)

    // Fetch contacts from Resend. The list contacts endpoint currently
    // returns all contacts in a single response (no documented cursor),
    // but we still loop defensively in case pagination is added later.
    const allContacts: ResendContact[] = []
    let nextUrl: string | null = `https://api.resend.com/audiences/${audienceId}/contacts`

    while (nextUrl) {
      const response: Response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Resend API error: ${response.status} - ${errorText}`)
        return new Response(
          JSON.stringify({ error: `Resend API error: ${response.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body: ResendListResponse & { has_more?: boolean; next_url?: string } = await response.json()
      if (Array.isArray(body.data)) {
        allContacts.push(...body.data)
      }

      // Resend currently doesn't expose a paging cursor for this endpoint,
      // but if/when they add `next_url` we'll follow it.
      nextUrl = body.has_more && body.next_url ? body.next_url : null
    }

    const stats: AudienceStats = {
      totalContacts: allContacts.length,
      subscribers: allContacts.filter((c) => !c.unsubscribed).length,
      unsubscribers: allContacts.filter((c) => c.unsubscribed).length,
    }

    console.log(`📊 Audience stats: ${JSON.stringify(stats)}`)

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in get-resend-audience-stats:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
