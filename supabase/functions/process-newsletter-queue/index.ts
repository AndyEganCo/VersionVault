// Supabase Edge Function for processing newsletter queue
// Triggered hourly to send emails to users where it's 8am in their timezone
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import PQueue from 'https://esm.sh/p-queue@7.3.4'
import { authorizeRequest, getCorsHeaders } from '../_shared/newsletter-auth.ts'
import { isTargetHourInTimezone } from '../_shared/newsletter-scheduler.ts'
import { updateLastNotified } from '../_shared/newsletter-db.ts'

const corsHeaders = getCorsHeaders()

const BATCH_SIZE = 100
const MAX_RETRY_ATTEMPTS = 3
const VERSIONVAULT_FROM = 'VersionVault <digest@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

// ✅ Parallel queue with rate limiting (2 req/sec = Resend limit)
const emailQueue = new PQueue({
  concurrency: 2,      // 2 requests at a time
  interval: 1000,      // per second
  intervalCap: 2       // = 2 req/sec
})

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
    // ✅ Authorization using shared utility
    await authorizeRequest(req)
    console.log('✅ Authorization successful')

    // Check environment variables
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

    // Parse request body for force flag
    let forceProcess = false
    try {
      const clonedReq = req.clone()
      const body = await clonedReq.json()
      forceProcess = body?.force === true
    } catch {
      // No body or invalid JSON, that's fine
    }

    console.log('📤 Starting newsletter queue processing...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const now = new Date()
    const targetHour = 8 // 8am

    // ✅ Get pending queue items (ordered by priority for test sends)
    // If force=true, get all pending items regardless of scheduled time
    let query = supabase
      .from('newsletter_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', MAX_RETRY_ATTEMPTS)
      .order('priority', { ascending: false })  // High priority first (test sends)
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE)

    // Only filter by scheduled_for if not forcing
    if (!forceProcess) {
      query = query.lte('scheduled_for', now.toISOString())
    }

    const { data: queueItems, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch queue: ${fetchError.message}`)
    }

    // ✅ Filter to only users where it's currently target hour in their timezone
    // Skip timezone filter if manually triggered with force=true
    const shouldBypassTimezone = forceProcess

    const itemsToProcess = shouldBypassTimezone
      ? (queueItems || [])
      : (queueItems || []).filter(item => isTargetHourInTimezone(item.timezone, targetHour))

    if (shouldBypassTimezone) {
      console.log('⚡ Force-processing: bypassing timezone filter')
    }

    console.log(`📋 Found ${itemsToProcess.length} items to process (${queueItems?.length || 0} total pending)`)

    const result: ProcessResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    }

    // ✅ Process items in PARALLEL with rate limiting using p-queue
    console.log(`⚡ Processing ${itemsToProcess.length} emails in parallel (2 concurrent, rate limited to 2 req/sec)`)

    const startTime = Date.now()

    // Helper function to process a single queue item
    const processQueueItem = async (item: any) => {
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
            new_software: item.payload.newSoftware || [],
            resend_id: emailData?.id,
            status: 'sent',
          })

        // ✅ Update last_notified_version using shared utility
        if (item.payload.updates && item.payload.updates.length > 0) {
          await updateLastNotified(
            supabase,
            item.user_id,
            item.payload.updates.map((u: any) => ({
              software_id: u.software_id,
              version: u.new_version
            }))
          )
        }

        // Increment sponsor impressions if present
        if (item.payload.sponsor?.id) {
          await supabase
            .from('newsletter_sponsors')
            .update({
              impression_count: supabase.raw('impression_count + 1')
            })
            .eq('id', item.payload.sponsor.id)
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

    // Add all items to the queue for parallel processing
    for (const item of itemsToProcess) {
      emailQueue.add(() => processQueueItem(item))
    }

    // Wait for all emails to be processed
    await emailQueue.onIdle()

    const executionTime = Date.now() - startTime
    console.log(`\n✅ Queue processing complete in ${executionTime}ms!`)
    console.log(`   Processed: ${result.processed}`)
    console.log(`   Sent: ${result.sent}`)
    console.log(`   Failed: ${result.failed}`)
    console.log(`   Avg time per email: ${Math.round(executionTime / result.processed)}ms`)

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
  // Handle no_tracking_reminder separately
  if (item.email_type === 'no_tracking_reminder') {
    return generateNoTrackingReminderContent(item)
  }

  const updates = item.payload.updates || []
  const updateCount = updates.length
  const hasUpdates = updateCount > 0
  const newSoftware = item.payload.newSoftware || []
  const newSoftwareCount = newSoftware.length
  const sponsor = item.payload.sponsor
  const allQuietMessage = item.payload.all_quiet_message
  const trackedCount = item.payload.tracked_count || 0

  // Extract frequency from email_type or payload
  let frequency: string
  let digestLabel: string

  if (item.email_type === 'all_quiet') {
    // For all_quiet emails, get frequency from payload
    frequency = item.payload.frequency || 'weekly'
    digestLabel = 'All Quiet Digest'
  } else {
    // For digest emails, extract from email_type (e.g., "weekly_digest" -> "weekly")
    frequency = item.email_type.replace('_digest', '').toLowerCase()
    digestLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1) + ' Digest'
  }

  // Determine time period for messaging
  const timePeriod = frequency === 'daily' ? 'today' : frequency === 'monthly' ? 'this month' : 'this week'

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
    newSoftware,
    newSoftwareCount,
    sponsor,
    allQuietMessage,
    trackedCount,
    userId: item.user_id,
    digestLabel,
    timePeriod,
  })

  // Generate plain text
  const text = generateTextEmail({
    userName,
    updates,
    hasUpdates,
    newSoftware,
    newSoftwareCount,
    allQuietMessage,
    trackedCount,
    digestLabel,
    timePeriod,
  })

  return { subject, html, text }
}

// Generate HTML email content
function generateHtmlEmail(data: any): string {
  const { userName, updates, hasUpdates, newSoftware, newSoftwareCount, sponsor, allQuietMessage, trackedCount, userId, digestLabel, timePeriod } = data

  const updateCards = updates.map((u: any) => `
    <a href="${VERSIONVAULT_URL}/dashboard?software_id=${u.software_id}" style="text-decoration: none; display: block; color: inherit;">
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
    </a>
  `).join('')

  const newSoftwareCards = newSoftware.map((s: any) => `
    <a href="${VERSIONVAULT_URL}/dashboard?software_id=${s.software_id}" style="text-decoration: none; display: block; color: inherit;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${s.name}</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #8b5cf6; padding: 3px 8px; border-radius: 4px;">TRACKING</span>
        </div>
        <div style="font-size: 13px; color: #a3a3a3; margin: 4px 0 12px 0;">${s.manufacturer} • ${s.category}</div>
        <div style="font-size: 14px; font-family: monospace;">
          <span style="color: #737373;">Current Version: </span>
          <span style="color: #8b5cf6; font-weight: 600;">${s.initial_version}</span>
        </div>
        <div style="font-size: 12px; color: #525252; margin-top: 4px;">Started tracking ${formatDate(s.added_date)}</div>
      </div>
    </a>
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
        ${digestLabel}
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      ${hasUpdates ? `
        <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
          Here's what changed in the <strong>${updates.length}</strong> app${updates.length === 1 ? '' : 's'} you're tracking ${timePeriod}:
        </div>
      ` : `
        <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
          No updates ${timePeriod} for the software you're tracking. We'll keep watching!
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

    ${newSoftwareCount > 0 ? `
      <!-- New Software -->
      <div style="padding: 24px 24px 0 24px;">
        <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">🆕 Now Tracking</div>
        <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 16px;">You started tracking ${newSoftwareCount} new ${newSoftwareCount === 1 ? 'app' : 'apps'} ${timePeriod}</div>
        ${newSoftwareCards}
      </div>
    ` : ''}

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
  const { userName, updates, hasUpdates, newSoftware, newSoftwareCount, allQuietMessage, trackedCount, digestLabel, timePeriod } = data

  let text = `>_ VersionVault - ${digestLabel}\n\n`
  text += `Hey ${userName},\n\n`

  if (hasUpdates) {
    text += `Here's what changed in the ${updates.length} app${updates.length === 1 ? '' : 's'} you're tracking ${timePeriod}:\n\n`

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

  if (newSoftwareCount > 0) {
    text += `🆕 NOW TRACKING\n\n`
    text += `You started tracking ${newSoftwareCount} new ${newSoftwareCount === 1 ? 'app' : 'apps'} ${timePeriod}:\n\n`

    for (const s of newSoftware) {
      text += `${s.name} (TRACKING)\n`
      text += `${s.manufacturer} • ${s.category}\n`
      text += `Current Version: ${s.initial_version}\n`
      text += `Started tracking ${formatDate(s.added_date)}\n\n`
    }
  }

  text += `---\n`
  text += `Manage Preferences: ${VERSIONVAULT_URL}/user/notifications\n`
  text += `Unsubscribe: ${VERSIONVAULT_URL}/unsubscribe\n\n`
  text += `© ${new Date().getFullYear()} VersionVault`

  return text
}

// Generate no tracking reminder email content
function generateNoTrackingReminderContent(item: any): { subject: string; html: string; text: string } {
  const popularSoftware = item.payload.popularSoftware || []
  const sponsor = item.payload.sponsor
  const subjectLine = item.payload.subject_line || "Your software tracker is looking a bit empty..."

  // Extract username from email
  const userName = item.email.split('@')[0]

  // Generate HTML
  const html = generateNoTrackingReminderHtml({
    userName,
    popularSoftware,
    sponsor,
    userId: item.user_id,
  })

  // Generate plain text
  const text = generateNoTrackingReminderText({
    userName,
    popularSoftware,
  })

  return { subject: subjectLine, html, text }
}

// Generate HTML for no tracking reminder
function generateNoTrackingReminderHtml(data: any): string {
  const { userName, popularSoftware, sponsor, userId } = data

  const softwareCards = popularSoftware.map((s: any) => `
    <a href="${VERSIONVAULT_URL}/software?software_id=${s.software_id}" style="text-decoration: none; display: block; color: inherit;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">${s.name}</div>
        <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 12px;">${s.manufacturer} • ${s.category}</div>
        <div style="font-size: 14px; color: #737373; font-family: monospace; margin-bottom: 12px;">
          Latest: <span style="color: #22c55e; font-weight: 600;">${s.current_version}</span>
        </div>
        <div style="font-size: 13px; font-weight: 500; color: #3b82f6;">Track This →</div>
      </div>
    </a>
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
        TRACKING REMINDER
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px 24px 0 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        We noticed you haven't tracked any software yet. You're missing out on automatic version updates!
      </div>
    </div>

    <!-- Main Message -->
    <div style="padding: 32px 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
      <div style="font-size: 20px; font-weight: 600; color: #ffffff; margin-bottom: 12px;">Your watchlist is feeling lonely</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.5;">Track software to get notified about updates, security patches, and new releases — all automatically.</div>
    </div>

    <!-- Benefits -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="font-size: 12px; font-weight: 600; color: #525252; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 16px;">WHY TRACK SOFTWARE?</div>

      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
        <div style="font-size: 20px; margin-bottom: 8px;">🔔</div>
        <div style="font-size: 13px; color: #a3a3a3; line-height: 1.5;">
          <strong style="color: #ffffff;">Never miss critical updates</strong><br />
          Get notified when your tools release new versions
        </div>
      </div>

      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
        <div style="font-size: 20px; margin-bottom: 8px;">🛡️</div>
        <div style="font-size: 13px; color: #a3a3a3; line-height: 1.5;">
          <strong style="color: #ffffff;">Stay ahead of breaking changes</strong><br />
          See major, minor, and patch releases at a glance
        </div>
      </div>

      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
        <div style="font-size: 20px; margin-bottom: 8px;">🔐</div>
        <div style="font-size: 13px; color: #a3a3a3; line-height: 1.5;">
          <strong style="color: #ffffff;">Security patch alerts</strong><br />
          Know when security updates are available
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 8px 24px 32px 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/software" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 32px; border-radius: 8px; text-decoration: none;">Browse Software</a>
      <div style="font-size: 12px; color: #525252; margin-top: 12px;">Start tracking your favorite tools</div>
    </div>

    ${popularSoftware.length > 0 ? `
      <!-- Popular Software -->
      <div style="padding: 24px 24px 0 24px;">
        <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">🔥 Popular Software</div>
        <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 16px;">Most tracked by the community</div>
        ${softwareCards}
        <div style="text-align: center; margin-top: 16px; margin-bottom: 24px;">
          <a href="${VERSIONVAULT_URL}/software" style="font-size: 13px; color: #3b82f6; text-decoration: none;">View all software →</a>
        </div>
      </div>
    ` : ''}

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

// Generate plain text for no tracking reminder
function generateNoTrackingReminderText(data: any): string {
  const { userName, popularSoftware } = data

  let text = `>_ VersionVault - Tracking Reminder\n\n`
  text += `Hey ${userName},\n\n`
  text += `We noticed you haven't tracked any software yet. You're missing out on automatic version updates!\n\n`
  text += `Your watchlist is feeling lonely. Track software to get notified about updates, security patches, and new releases — all automatically.\n\n`

  text += `WHY TRACK SOFTWARE?\n\n`
  text += `🔔 Never miss critical updates\n`
  text += `   Get notified when your tools release new versions\n\n`
  text += `🛡️ Stay ahead of breaking changes\n`
  text += `   See major, minor, and patch releases at a glance\n\n`
  text += `🔐 Security patch alerts\n`
  text += `   Know when security updates are available\n\n`

  if (popularSoftware.length > 0) {
    text += `🔥 POPULAR SOFTWARE\n\n`
    text += `Most tracked by the community:\n\n`

    for (const s of popularSoftware) {
      text += `${s.name}\n`
      text += `${s.manufacturer} • ${s.category}\n`
      text += `Latest: ${s.current_version}\n\n`
    }
  }

  text += `Browse Software: ${VERSIONVAULT_URL}/software\n\n`
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
