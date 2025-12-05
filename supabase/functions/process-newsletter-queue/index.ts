// Supabase Edge Function for processing newsletter queue
// Triggered hourly to send emails to users where it's 8am in their timezone
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 100
const MAX_RETRY_ATTEMPTS = 3
const VERSIONVAULT_FROM = 'VersionVault <digest@versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

interface ProcessResult {
  processed: number
  sent: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to process-newsletter-queue`)

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
    let isAdminRequest = false

    // Parse request body for force flag
    let forceProcess = false
    try {
      const body = await req.json()
      forceProcess = body?.force === true
    } catch {
      // No body or invalid JSON, that's fine
    }

    // Check cron secret
    if (cronSecret) {
      if (customSecretHeader === cronSecret) isAuthorized = true
      if (authHeader?.replace('Bearer ', '') === cronSecret) isAuthorized = true
    }

    // Check if user is an admin via JWT
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)

      // Verify the JWT and get user
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

      if (!authError && user) {
        // Check if user is admin
        const { data: adminData } = await supabaseAuth
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .single()

        if (adminData) {
          isAuthorized = true
          isAdminRequest = true
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
    console.log('📤 Starting newsletter queue processing...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const now = new Date()
    const targetHour = 8 // 8am

    // Get pending queue items that are scheduled for now or earlier
    const { data: queueItems, error: fetchError } = await supabase
      .from('newsletter_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .lt('attempts', MAX_RETRY_ATTEMPTS)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch queue: ${fetchError.message}`)
    }

    // Filter to only users where it's currently target hour in their timezone
    // Skip timezone filter if admin manually triggered with force=true
    const shouldBypassTimezone = isAdminRequest && forceProcess

    const itemsToProcess = shouldBypassTimezone
      ? (queueItems || [])
      : (queueItems || []).filter(item => {
          try {
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: item.timezone,
              hour: 'numeric',
              hour12: false,
            })
            const currentHour = parseInt(formatter.format(now), 10)
            return currentHour === targetHour
          } catch {
            // Invalid timezone, process anyway
            return true
          }
        })

    if (shouldBypassTimezone) {
      console.log('⚡ Admin force-processing: bypassing timezone filter')
    }

    console.log(`📋 Found ${itemsToProcess.length} items to process (${queueItems?.length || 0} total pending)`)

    const result: ProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    }

    // Process each queue item
    for (const item of itemsToProcess) {
      result.processed++

      try {
        // Mark as processing
        await supabase
          .from('newsletter_queue')
          .update({ status: 'processing', attempts: item.attempts + 1 })
          .eq('id', item.id)

        // Generate email content
        const { subject, html, text } = generateEmailContent(item)

        // Send via Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: VERSIONVAULT_FROM,
          to: item.email,
          subject,
          html,
          text,
          headers: {
            'X-Entity-Ref-ID': item.id,
            'List-Unsubscribe': `<${VERSIONVAULT_URL}/unsubscribe?uid=${item.user_id}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        })

        if (emailError) {
          throw new Error(emailError.message)
        }

        // Update queue item as sent
        await supabase
          .from('newsletter_queue')
          .update({
            status: 'sent',
            resend_id: emailData?.id,
            sent_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        // Log the sent email
        await supabase
          .from('newsletter_logs')
          .insert({
            user_id: item.user_id,
            email: item.email,
            email_type: item.email_type,
            subject,
            software_updates: item.payload.updates || [],
            resend_id: emailData?.id,
            status: 'sent',
          })

        // Update last_notified_version for tracked software
        if (item.payload.updates && item.payload.updates.length > 0) {
          for (const update of item.payload.updates) {
            await supabase
              .from('tracked_software')
              .update({
                last_notified_version: update.new_version,
                last_notified_at: new Date().toISOString(),
              })
              .eq('user_id', item.user_id)
              .eq('software_id', update.software_id)
          }
        }

        // Increment sponsor impressions if present
        if (item.payload.sponsor) {
          const { data: sponsorData } = await supabase
            .from('newsletter_sponsors')
            .select('impression_count')
            .eq('is_active', true)
            .single()

          if (sponsorData) {
            await supabase
              .from('newsletter_sponsors')
              .update({ impression_count: (sponsorData.impression_count || 0) + 1 })
              .eq('is_active', true)
          }
        }

        result.sent++
        console.log(`✅ Sent to ${item.email}`)

      } catch (error) {
        result.failed++
        result.errors.push({ userId: item.user_id, error: error.message })

        // Update queue item with error
        const isFinalFailure = item.attempts + 1 >= MAX_RETRY_ATTEMPTS
        await supabase
          .from('newsletter_queue')
          .update({
            status: isFinalFailure ? 'failed' : 'pending',
            last_error: error.message,
          })
          .eq('id', item.id)

        console.error(`❌ Failed for ${item.email}: ${error.message}`)
      }
    }

    console.log('\n✅ Queue processing complete!')
    console.log(`   Processed: ${result.processed}`)
    console.log(`   Sent: ${result.sent}`)
    console.log(`   Failed: ${result.failed}`)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in process-newsletter-queue:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate email content based on queue item
function generateEmailContent(item: any): { subject: string; html: string; text: string } {
  const updates = item.payload.updates || []
  const updateCount = updates.length
  const hasUpdates = updateCount > 0
  const sponsor = item.payload.sponsor
  const allQuietMessage = item.payload.all_quiet_message
  const trackedCount = item.payload.tracked_count || 0

  // Generate subject
  let subject: string
  if (item.email_type === 'all_quiet') {
    subject = 'All quiet on the version front'
  } else if (hasUpdates) {
    subject = `${updateCount} update${updateCount === 1 ? '' : 's'} for your tracked software`
  } else {
    subject = 'Your Version Digest'
  }

  // Extract username from email
  const userName = item.email.split('@')[0]

  // Generate HTML
  const html = generateHtmlEmail({
    userName,
    updates,
    hasUpdates,
    sponsor,
    allQuietMessage,
    trackedCount,
    userId: item.user_id,
  })

  // Generate plain text
  const text = generateTextEmail({
    userName,
    updates,
    hasUpdates,
    allQuietMessage,
    trackedCount,
  })

  return { subject, html, text }
}

// Generate HTML email content
function generateHtmlEmail(data: any): string {
  const { userName, updates, hasUpdates, sponsor, allQuietMessage, trackedCount, userId } = data

  const updateCards = updates.map((u: any) => `
    <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${u.name}</span>
        <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: ${getTypeColor(u.update_type)}; padding: 3px 8px; border-radius: 4px;">${u.update_type.toUpperCase()}</span>
      </div>
      <div style="font-size: 13px; color: #a3a3a3; margin: 4px 0 12px 0;">${u.manufacturer} • ${u.category}</div>
      <div style="font-size: 14px; font-family: monospace;">
        <span style="color: #737373;">${u.old_version}</span>
        <span style="color: #525252;"> → </span>
        <span style="color: #22c55e; font-weight: 600;">${u.new_version}</span>
      </div>
      <div style="font-size: 12px; color: #525252; margin-top: 4px;">Released ${formatDate(u.release_date)}</div>
      ${u.release_notes && u.release_notes.length > 0 ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #262626;">
          ${u.release_notes.slice(0, 2).map((note: string) => `<div style="font-size: 12px; color: #a3a3a3; margin-bottom: 4px;">• ${note}</div>`).join('')}
          ${u.release_notes.length > 2 ? `<div style="font-size: 12px; color: #525252; font-style: italic;">+${u.release_notes.length - 2} more changes</div>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('')

  const sponsorHtml = sponsor ? `
    <div style="padding: 24px;">
      <div style="font-size: 10px; font-weight: 600; color: #525252; text-align: center; margin-bottom: 8px; letter-spacing: 1px;">SPONSOR</div>
      <a href="${sponsor.cta_url}" style="text-decoration: none;">
        <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${sponsor.name}</div>
          ${sponsor.tagline ? `<div style="font-size: 13px; color: #3b82f6; margin-top: 4px;">${sponsor.tagline}</div>` : ''}
          ${sponsor.description ? `<div style="font-size: 13px; color: #a3a3a3; margin-top: 8px; line-height: 1.5;">${sponsor.description}</div>` : ''}
          <div style="display: inline-block; font-size: 12px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 8px 16px; border-radius: 6px; margin-top: 12px;">${sponsor.cta_text}</div>
        </div>
      </a>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
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
        ${hasUpdates ? 'Weekly Digest' : 'Weekly Digest'}
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      ${hasUpdates ? `
        <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
          Here's what changed in the <strong>${updates.length}</strong> app${updates.length === 1 ? '' : 's'} you're tracking this week:
        </div>
      ` : `
        <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
          No updates this week for the software you're tracking. We'll keep watching!
        </div>
      `}
    </div>

    ${hasUpdates ? `
      <!-- Updates -->
      <div style="padding: 0 24px 24px 24px;">
        ${updateCards}
        <div style="text-align: center; margin-top: 16px;">
          <a href="${VERSIONVAULT_URL}/dashboard" style="font-size: 13px; color: #3b82f6; text-decoration: none;">View all in dashboard →</a>
        </div>
      </div>
    ` : `
      <!-- All Quiet -->
      <div style="padding: 32px 24px 48px 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">🌙</div>
        <div style="font-size: 18px; color: #ffffff; font-style: italic; margin-bottom: 12px;">${allQuietMessage || "All quiet on the version front."}</div>
        <div style="font-size: 14px; color: #737373;">Watching <strong>${trackedCount}</strong> app${trackedCount === 1 ? '' : 's'} for you</div>
        <div style="margin-top: 24px;">
          <a href="${VERSIONVAULT_URL}/dashboard" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #262626; border: 1px solid #404040; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Open Dashboard</a>
        </div>
      </div>
    `}

    ${sponsorHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="${VERSIONVAULT_URL}/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="${VERSIONVAULT_URL}/unsubscribe?uid=${userId}" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="${VERSIONVAULT_URL}" style="color: #a3a3a3; text-decoration: underline;">Open Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `
}

// Generate plain text email content
function generateTextEmail(data: any): string {
  const { userName, updates, hasUpdates, allQuietMessage, trackedCount } = data

  let text = `>_ VersionVault - Weekly Digest\n\n`
  text += `Hey ${userName},\n\n`

  if (hasUpdates) {
    text += `Here's what changed in the ${updates.length} app${updates.length === 1 ? '' : 's'} you're tracking this week:\n\n`

    for (const u of updates) {
      text += `${u.name} (${u.update_type.toUpperCase()})\n`
      text += `${u.manufacturer} • ${u.category}\n`
      text += `${u.old_version} → ${u.new_version}\n`
      text += `Released ${formatDate(u.release_date)}\n`
      if (u.release_notes && u.release_notes.length > 0) {
        text += `Changes:\n`
        for (const note of u.release_notes.slice(0, 2)) {
          text += `  • ${note}\n`
        }
      }
      text += `\n`
    }

    text += `View all in dashboard: ${VERSIONVAULT_URL}/dashboard\n\n`
  } else {
    text += `${allQuietMessage || "All quiet on the version front."}\n\n`
    text += `Watching ${trackedCount} app${trackedCount === 1 ? '' : 's'} for you.\n\n`
    text += `Open Dashboard: ${VERSIONVAULT_URL}/dashboard\n\n`
  }

  text += `---\n`
  text += `Manage Preferences: ${VERSIONVAULT_URL}/user/notifications\n`
  text += `Unsubscribe: ${VERSIONVAULT_URL}/unsubscribe\n\n`
  text += `© ${new Date().getFullYear()} VersionVault`

  return text
}

// Helper functions
function getTypeColor(type: string): string {
  switch (type) {
    case 'major': return '#dc2626'
    case 'minor': return '#2563eb'
    case 'patch': return '#16a34a'
    default: return '#525252'
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}
