// Supabase Edge Function for queuing weekly digest emails
// Triggered by cron job on Sunday evening to prepare Monday's emails
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authorizeRequest, getCorsHeaders } from '../_shared/newsletter-auth.ts'
import {
  getTrackedSoftware,
  getCurrentVersionsBatch,
  getSoftwareDetails,
  checkBounces,
  getActiveSponsor,
  getNewSoftware
} from '../_shared/newsletter-db.ts'
import {
  calculateScheduledTime,
  getSinceDate,
  generateIdempotencyKey
} from '../_shared/newsletter-scheduler.ts'
import type {
  QueueSummary,
  QueueResult,
  SoftwareUpdateSummary,
  NotificationFrequency,
  CurrentVersion,
  SoftwareDetails,
  AllQuietPreference,
} from '../_shared/newsletter-types.ts'

const corsHeaders = getCorsHeaders()

const ALL_QUIET_MESSAGES = [
  "Your software is suspiciously stable this week. We're keeping an eye on it.",
  "Nothing to report. Your apps are quietly doing their jobs.",
  "Zero updates. Either everything's perfect, or the calm before the storm.",
  "All quiet on the version front. Enjoy it while it lasts.",
  "No updates detected. Time to grab a coffee instead of reading release notes.",
  "Your tracked apps are taking a well-deserved break this week.",
  "The update fairy took the week off. Check back soon!",
  "Silence in the changelog. Your software is vibing.",
]

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to queue-weekly-digest`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ✅ Authorization using shared utility
    await authorizeRequest(req)
    console.log('✅ Authorization successful')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get frequency from query parameter or request body, default to weekly
    let frequency: NotificationFrequency = 'weekly'
    let testUserId: string | undefined = undefined
    let testEmail: string | undefined = undefined
    let priority = 0

    // First try query parameter (more reliable)
    const url = new URL(req.url)
    const queryFrequency = url.searchParams.get('frequency')
    if (queryFrequency && ['daily', 'weekly', 'monthly'].includes(queryFrequency)) {
      frequency = queryFrequency as NotificationFrequency
      console.log(`✅ Frequency from query param: ${frequency}`)
    }

    // Parse request body for additional params
    try {
      const body = await req.json()
      if (body) {
        if (body.frequency && ['daily', 'weekly', 'monthly'].includes(body.frequency)) {
          frequency = body.frequency as NotificationFrequency
          console.log(`✅ Frequency from request body: ${frequency}`)
        }
        if (body.test_user_id) {
          testUserId = body.test_user_id
          console.log(`🧪 Test mode: queuing for user ID ${testUserId}`)
        }
        if (body.test_email) {
          testEmail = body.test_email
          console.log(`🧪 Test mode: queuing for email ${testEmail}`)
        }
        if (body.priority !== undefined) {
          priority = body.priority
          console.log(`⚡ Priority set to: ${priority}`)
        }
      }
    } catch (error) {
      console.log('No additional params in body, using defaults')
      // No body or invalid JSON, use defaults
    }

    // Fetch all auth users once (used for email lookup and subscriber mapping)
    // Note: listUsers() has a default limit of 50. Set perPage to ensure we get all users.
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000
    })

    if (authError) {
      throw new Error(`Failed to fetch user emails: ${authError.message}`)
    }

    // Create a map of user_id -> email
    const userEmailMap = new Map(
      authUsers.users.map(u => [u.id, u.email])
    )

    // If test_email provided, look up the user ID
    if (testEmail && !testUserId) {
      const targetUser = authUsers.users.find(u => u.email === testEmail)

      if (!targetUser) {
        console.log(`❌ User not found with email ${testEmail}`)
        return new Response(
          JSON.stringify({
            error: `User not found with email ${testEmail}`,
            totalUsers: 0,
            queued: 0,
            withUpdates: 0,
            allQuiet: 0,
            skipped: 0,
            errors: []
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      testUserId = targetUser.id
      console.log(`✅ Found user ${testUserId} for email ${testEmail}`)
    }

    console.log(`📬 Starting ${frequency} digest queue generation...`)

    // ✅ Calculate since date snapped to start of day (midnight UTC)
    let sinceDate = getSinceDate(frequency)

    // Get users who want this frequency of emails
    let userSettingsQuery = supabase
      .from('user_settings')
      .select('user_id, timezone, all_quiet_preference, notification_frequency')

    // If test mode, just filter to the specific user (ignore frequency and notification settings)
    if (testUserId) {
      userSettingsQuery = userSettingsQuery.eq('user_id', testUserId)
      console.log(`🧪 Test mode: bypassing notification_frequency and email_notifications filters`)
    } else {
      // Normal mode: filter by email_notifications and notification_frequency
      userSettingsQuery = userSettingsQuery
        .eq('email_notifications', true)
        .eq('notification_frequency', frequency)
    }

    const { data: userSettings, error: subError } = await userSettingsQuery

    if (subError) {
      throw new Error(`Failed to fetch subscribers: ${subError.message}`)
    }

    if (!userSettings || userSettings.length === 0) {
      console.log(`📋 No subscribers found${testUserId ? ' for test user' : ` for ${frequency} digest`}`)
      return new Response(
        JSON.stringify({
          totalUsers: 0,
          queued: 0,
          withUpdates: 0,
          allQuiet: 0,
          skipped: 0,
          errors: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // In test mode, use the user's actual notification frequency
    if (testUserId && userSettings.length > 0 && userSettings[0].notification_frequency) {
      frequency = userSettings[0].notification_frequency as NotificationFrequency
      console.log(`🧪 Test mode: using user's actual frequency: ${frequency}`)
      // Recalculate sinceDate based on user's actual frequency
      sinceDate = getSinceDate(frequency)
      console.log(`📅 Looking back to ${sinceDate.toISOString()} for updates`)
    }

    // Combine user settings with emails
    const subscribers = userSettings
      .map(settings => ({
        user_id: settings.user_id,
        timezone: settings.timezone,
        all_quiet_preference: settings.all_quiet_preference || 'always',
        email: userEmailMap.get(settings.user_id)
      }))
      .filter(sub => sub.email) // Only keep users with valid emails

    console.log(`📋 Found ${subscribers.length} subscribers for ${frequency} digest`)

    const results: QueueResult[] = []
    const errors: QueueResult[] = []
    let withUpdates = 0
    let allQuiet = 0
    let skipped = 0

    // ✅ Get active sponsor using shared utility
    const sponsor = await getActiveSponsor(supabase)
    const sponsorData = sponsor ? {
      id: sponsor.id,
      name: sponsor.name,
      tagline: sponsor.tagline,
      description: sponsor.description,
      image_url: sponsor.image_url,
      cta_url: sponsor.cta_url,
      cta_text: sponsor.cta_text,
    } : null

    // sinceDate already calculated above (snapped to midnight UTC)
    console.log(`📅 Using sinceDate: ${sinceDate.toISOString()}`)

    // Process each subscriber
    for (const sub of subscribers) {
      const userEmail = sub.email
      if (!userEmail) {
        skipped++
        continue
      }

      try {
        // ✅ Check bounce count using shared utility
        const bounceCount = await checkBounces(supabase, sub.user_id)
        if (bounceCount >= 3) {
          console.log(`⏭️  Skipping ${userEmail} - too many bounces (${bounceCount})`)
          skipped++
          continue
        }

        // ✅ Get user's tracked software using shared utility
        const trackedSoftwareRaw = await getTrackedSoftware(supabase, sub.user_id)
        if (trackedSoftwareRaw.length === 0) {
          console.log(`⏭️  Skipping ${userEmail} - no tracked software`)
          skipped++
          continue
        }

        // ✅ Get software details using shared utility
        const softwareIds = trackedSoftwareRaw.map(t => t.software_id)
        const softwareDetails = await getSoftwareDetails(supabase, softwareIds)

        // Map software details
        const softwareMap = new Map<string, SoftwareDetails>(
          softwareDetails.map(s => [s.id, s])
        )

        // Combine tracked software with details
        const trackedSoftware = trackedSoftwareRaw.map(tracked => ({
          software_id: tracked.software_id,
          last_notified_version: tracked.last_notified_version,
          software: softwareMap.get(tracked.software_id)
        }))

        // ✅ OPTIMIZED: Use batch function to get ONLY current versions
        console.log(`📊 Fetching current versions for ${softwareIds.length} tracked software...`)
        const currentVersions = await getCurrentVersionsBatch(supabase, softwareIds)
        console.log(`✅ Got ${currentVersions.length} current versions`)

        // Create a map of software_id -> current version
        const currentVersionMap = new Map<string, CurrentVersion>(
          currentVersions.map(v => [v.software_id, v])
        )

        // Process each tracked software to find updates
        const updates: SoftwareUpdateSummary[] = []
        let skippedOldRelease = 0

        for (const tracked of trackedSoftware) {
          const software = tracked.software
          if (!software) continue

          const currentVersion = currentVersionMap.get(tracked.software_id)
          if (!currentVersion) continue

          // Check if the current version was released in the time period
          const releaseDate = currentVersion.release_date || currentVersion.detected_at
          const releaseDateObj = new Date(releaseDate)
          if (releaseDateObj < sinceDate) {
            // Current version was released before the time period, skip
            skippedOldRelease++
            continue
          }

          console.log(`  ✅ Including ${software.name}: ${currentVersion.current_version} (released ${releaseDate})`)
          updates.push({
            software_id: tracked.software_id,
            name: software.name,
            manufacturer: software.manufacturer,
            category: software.category,
            old_version: tracked.last_notified_version || currentVersion.current_version,
            new_version: currentVersion.current_version,
            release_date: releaseDate,
            release_notes: currentVersion.notes || [],
            update_type: currentVersion.type as SoftwareUpdateSummary['update_type'] || 'patch',
          })
        }

        console.log(`  📊 Update filtering: ${updates.length} included, ${skippedOldRelease} released before lookback period`)

        // Sort updates by release date (newest first)
        updates.sort((a, b) => {
          const dateA = new Date(a.release_date).getTime()
          const dateB = new Date(b.release_date).getTime()
          return dateB - dateA
        })

        const hasUpdates = updates.length > 0

        // ✅ OPTIMIZED: Use utility function to get new software with current versions
        const newSoftware = await getNewSoftware(supabase, sub.user_id, sinceDate)
        console.log(`📦 Found ${newSoftware.length} new software for ${userEmail} (looking back to ${sinceDate.toISOString()})`)

        // Check if we should send an all_quiet email based on user preference
        if (!hasUpdates) {
          const allQuietPref: AllQuietPreference = (sub.all_quiet_preference as AllQuietPreference) || 'always'

          // Determine if we should send all quiet email
          const shouldSendAllQuiet =
            allQuietPref === 'always' ||
            (allQuietPref === 'new_software_only' && newSoftware.length > 0)

          if (!shouldSendAllQuiet) {
            // Skip this user - no email sent
            console.log(`⏭️  Skipping ${userEmail} - no updates and all_quiet_preference is '${allQuietPref}'`)
            skipped++
            continue
          }
        }

        // ✅ Generate idempotency key using shared utility
        const idempotencyKey = generateIdempotencyKey(sub.user_id, frequency)

        // ✅ Calculate scheduled time (8am in user's timezone - next occurrence)
        const scheduledFor = calculateScheduledTime(frequency, sub.timezone || 'America/New_York')

        // Determine email type and payload
        const emailType = hasUpdates ? `${frequency}_digest` : 'all_quiet'
        const payload = {
          updates: updates,
          newSoftware: newSoftware.length > 0 ? newSoftware : undefined,
          sponsor: sponsorData,
          all_quiet_message: hasUpdates ? undefined : ALL_QUIET_MESSAGES[Math.floor(Math.random() * ALL_QUIET_MESSAGES.length)],
          tracked_count: trackedSoftware.length,
          frequency: frequency,
        }

        // Insert into queue
        const { error: insertError } = await supabase
          .from('newsletter_queue')
          .upsert({
            user_id: sub.user_id,
            email: userEmail,
            email_type: emailType,
            payload,
            status: 'pending',
            scheduled_for: scheduledFor.toISOString(),
            timezone: sub.timezone || 'America/New_York',
            priority: priority,
            idempotency_key: idempotencyKey,
          }, {
            onConflict: 'idempotency_key',
            ignoreDuplicates: true,
          })

        if (insertError) {
          throw new Error(insertError.message)
        }

        if (hasUpdates) {
          withUpdates++
        } else {
          allQuiet++
        }

        results.push({
          user_id: sub.user_id,
          email: userEmail,
          success: true,
        })

        console.log(`✅ Queued for ${userEmail}: ${updates.length} updates`)

      } catch (error) {
        const result: QueueResult = {
          user_id: sub.user_id,
          email: userEmail,
          success: false,
          error: error.message,
        }
        results.push(result)
        errors.push(result)
        console.error(`❌ Failed for ${userEmail}: ${error.message}`)
      }
    }

    const summary: QueueSummary = {
      totalUsers: subscribers.length,
      queued: results.filter(r => r.success).length,
      withUpdates,
      allQuiet,
      skipped,
      errors,
    }

    console.log('\n✅ Queue generation complete!')
    console.log(`   Total users: ${summary.totalUsers}`)
    console.log(`   Queued: ${summary.queued}`)
    console.log(`   With updates: ${summary.withUpdates}`)
    console.log(`   All quiet: ${summary.allQuiet}`)
    console.log(`   Skipped: ${summary.skipped}`)
    console.log(`   Errors: ${summary.errors.length}`)

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in queue-weekly-digest:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
