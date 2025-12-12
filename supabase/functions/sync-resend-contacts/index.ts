// Supabase Edge Function to sync user contacts to Resend Audiences
// This creates/updates contacts in Resend's contact management system
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  totalUsers: number
  synced: number
  failed: number
  errors: Array<{ email: string; error: string }>
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to sync-resend-contacts`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const customSecretHeader = req.headers.get('X-Cron-Secret')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let isAuthorized = false

    // Check cron secret
    if (cronSecret) {
      if (customSecretHeader === cronSecret) isAuthorized = true
      if (authHeader?.replace('Bearer ', '') === cronSecret) isAuthorized = true
    }

    // Check if user is an admin via JWT
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

      if (!authError && user) {
        const { data: adminData } = await supabaseAuth
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .single()

        if (adminData) {
          isAuthorized = true
          console.log(`✅ Admin user ${user.id} authorized`)
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Authorization successful')
    console.log('📤 Starting Resend contact sync...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Get only PENDING syncs (users that need to be synced)
    const { data: pendingSyncs, error: syncError } = await supabase
      .from('resend_contact_sync')
      .select('user_id, email')
      .eq('sync_status', 'pending')

    if (syncError) {
      throw new Error(`Failed to fetch pending syncs: ${syncError.message}`)
    }

    if (!pendingSyncs || pendingSyncs.length === 0) {
      console.log('✅ No pending syncs found')
      return new Response(
        JSON.stringify({
          totalUsers: 0,
          synced: 0,
          failed: 0,
          errors: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${pendingSyncs.length} pending syncs`)

    // Get user settings for pending users only
    const userIds = pendingSyncs.map(s => s.user_id)
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, email_notifications, notification_frequency, timezone')
      .in('user_id', userIds)

    if (settingsError) {
      throw new Error(`Failed to fetch user settings: ${settingsError.message}`)
    }

    // Create a map of user settings
    const settingsMap = new Map(
      (userSettings || []).map(s => [s.user_id, s])
    )

    // Get user metadata from auth.users for the pending users
    const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      throw new Error(`Failed to fetch users: ${authError.message}`)
    }

    // Create map of user metadata
    const userMetadataMap = new Map(
      authUsers.map(u => [u.id, u.user_metadata])
    )

    const result: SyncResult = {
      totalUsers: pendingSyncs.length,
      synced: 0,
      failed: 0,
      errors: [],
    }

    // Get or create audience ID (required for Resend Audiences API)
    const audienceId = Deno.env.get('RESEND_AUDIENCE_ID')

    if (!audienceId) {
      throw new Error('RESEND_AUDIENCE_ID environment variable is required')
    }

    console.log(`📋 Syncing ${pendingSyncs.length} pending users to audience ${audienceId}`)

    // Helper function to delay between requests (rate limiting)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Sync each pending user with rate limiting (max 2 requests/second = 500ms delay)
    for (let i = 0; i < pendingSyncs.length; i++) {
      const pendingSync = pendingSyncs[i]
      if (!pendingSync.email) continue

      const settings = settingsMap.get(pendingSync.user_id)
      const userMetadata = userMetadataMap.get(pendingSync.user_id) || {}

      try {
        // Add contact to audience using Resend REST API
        const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: pendingSync.email,
            first_name: userMetadata.first_name || '',
            last_name: userMetadata.last_name || '',
            unsubscribed: settings?.email_notifications === false,
          }),
        })

        if (!response.ok) {
          const errorData = await response.text()
          throw new Error(`Resend API error: ${response.status} - ${errorData}`)
        }

        const data = await response.json()

        // Update sync tracking in Supabase
        await supabase
          .from('resend_contact_sync')
          .update({
            sync_status: 'synced',
            resend_contact_id: data.id,
            last_synced_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('user_id', pendingSync.user_id)

        result.synced++
        console.log(`✅ Synced ${pendingSync.email}`)

      } catch (error) {
        result.failed++
        result.errors.push({
          email: pendingSync.email,
          error: error.message,
        })

        // Update sync tracking with error
        await supabase
          .from('resend_contact_sync')
          .update({
            sync_status: 'failed',
            last_error: error.message,
          })
          .eq('user_id', pendingSync.user_id)

        console.error(`❌ Failed to sync ${pendingSync.email}: ${error.message}`)
      }

      // Rate limit: Wait 600ms between requests (allows ~1.6 req/sec, safely under 2 req/sec limit)
      if (i < pendingSyncs.length - 1) {
        await delay(600)
      }
    }

    console.log('\n✅ Contact sync complete!')
    console.log(`   Total users: ${result.totalUsers}`)
    console.log(`   Synced: ${result.synced}`)
    console.log(`   Failed: ${result.failed}`)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sync-resend-contacts:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
