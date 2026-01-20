// Supabase Edge Function for queuing weekly digest emails
// Triggered by cron job on Sunday evening to prepare Monday's emails
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compareVersions } from '../_shared/version-utils.ts'
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
  getSinceDays,
  generateIdempotencyKey
} from '../_shared/newsletter-scheduler.ts'
import type {
  QueueSummary,
  QueueResult,
  SoftwareUpdateSummary,
  NewSoftwareSummary
} from '../_shared/newsletter-types.ts'

const corsHeaders = getCorsHeaders()

// Constants
const MAX_UPDATES_PER_EMAIL = 20
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

interface QueueResult {
  userId: string
  email: string
  success: boolean
  hasUpdates: boolean
  updateCount: number
  error?: string
}

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
    let frequency = 'weekly'
    let testUserId: string | undefined = undefined
    let testEmail: string | undefined = undefined
    let priority = 0

    // First try query parameter (more reliable)
    const url = new URL(req.url)
    const queryFrequency = url.searchParams.get('frequency')
    if (queryFrequency) {
      frequency = queryFrequency
      console.log(`✅ Frequency from query param: ${frequency}`)
    }

    // Parse request body for additional params
    try {
      const body = await req.json()
      if (body) {
        if (body.frequency) {
          frequency = body.frequency
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

    // If test_email provided, look up the user ID
    if (testEmail && !testUserId) {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        perPage: 1000
      })

      if (authError) {
        console.error('Failed to fetch users for email lookup:', authError)
        return new Response(
          JSON.stringify({ error: 'Failed to look up user by email' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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

    // ✅ Calculate days to look back using shared utility
    const sinceDays = getSinceDays(frequency as any)

    // Get users who want this frequency of emails
    let userSettingsQuery = supabase
      .from('user_settings')
      .select('user_id, timezone, all_quiet_preference')
      .eq('email_notifications', true)
      .eq('notification_frequency', frequency)

    // If test mode, filter to specific user
    if (testUserId) {
      userSettingsQuery = userSettingsQuery.eq('user_id', testUserId)
    }

    const { data: userSettings, error: subError } = await userSettingsQuery

    if (subError) {
      throw new Error(`Failed to fetch subscribers: ${subError.message}`)
    }

    if (!userSettings || userSettings.length === 0) {
      console.log(`📋 No subscribers found for ${frequency} digest`)
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

    // Get user emails from auth.users
    // Note: listUsers() has a default limit of 50. Set perPage to ensure we get all users.
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: 1000 // Fetch up to 1000 users (covers growth)
    })

    if (authError) {
      throw new Error(`Failed to fetch user emails: ${authError.message}`)
    }

    // Create a map of user_id -> email
    const userEmailMap = new Map(
      authUsers.users.map(u => [u.id, u.email])
    )

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
        const softwareMap = new Map(
          softwareDetails.map(s => [s.id, s])
        )

        // Combine tracked software with details
        const trackedSoftware = trackedSoftwareRaw.map(tracked => ({
          software_id: tracked.software_id,
          last_notified_version: tracked.last_notified_version,
          software: softwareMap.get(tracked.software_id)
        }))

        // ✅ OPTIMIZED: Use batch function to get ONLY current versions
        // This is much faster than fetching all version history (1000+ rows → 100 rows)
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - sinceDays)

        console.log(`📊 Fetching current versions for ${softwareIds.length} tracked software...`)
        const currentVersions = await getCurrentVersionsBatch(supabase, softwareIds)
        console.log(`✅ Got ${currentVersions.length} current versions`)

        // Create a map of software_id -> current version
        const currentVersionMap = new Map(
          currentVersions.map(v => [v.software_id, v])
        )

        // Process each tracked software to find updates
        const updates: SoftwareUpdateSummary[] = []

        for (const tracked of trackedSoftware) {
          const software = tracked.software as any
          if (!software) continue

          const currentVersion = currentVersionMap.get(tracked.software_id)
          if (!currentVersion) continue

          // Check if the current version was released in the time period
          const releaseDate = currentVersion.release_date || currentVersion.detected_at
          const releaseDateObj = new Date(releaseDate)
          if (releaseDateObj < sinceDate) {
            // Current version was released before the time period, skip
            continue
          }

          // ✅ Previous version is tracked in last_notified_version
          const oldVersion = tracked.last_notified_version || 'N/A'

          updates.push({
            software_id: tracked.software_id,
            name: software.name,
            manufacturer: software.manufacturer,
            category: software.category,
            old_version: oldVersion,
            new_version: currentVersion.current_version,
            release_date: releaseDate,
            release_notes: currentVersion.notes || [],
            update_type: currentVersion.type || 'patch',
          })
        }

        // Show all updates (no limit)
        const hasUpdates = updates.length > 0

        // ✅ OPTIMIZED: Use utility function to get new software with current versions
        const newSoftware = await getNewSoftware(supabase, sub.user_id, sinceDate)

        // Check if we should send an all_quiet email based on user preference
        if (!hasUpdates) {
          const allQuietPref = sub.all_quiet_preference || 'always'

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
        const scheduledFor = calculateScheduledTime(frequency as any, sub.timezone || 'America/New_York')

        // Determine email type and payload
        const emailType = hasUpdates ? `${frequency}_digest` : 'all_quiet'
        const payload = {
          updates: updates,
          newSoftware: newSoftware.length > 0 ? newSoftware : undefined,
          sponsor: sponsorData,
          all_quiet_message: hasUpdates ? undefined : ALL_QUIET_MESSAGES[Math.floor(Math.random() * ALL_QUIET_MESSAGES.length)],
          tracked_count: trackedSoftware.length,
          frequency: frequency, // Include frequency for all_quiet emails
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
            priority: priority, // Support test sends with high priority
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
          userId: sub.user_id,
          email: userEmail,
          success: true,
          hasUpdates,
          updateCount: updates.length,
        })

        console.log(`✅ Queued for ${userEmail}: ${updates.length} updates`)

      } catch (error) {
        const result: QueueResult = {
          userId: sub.user_id,
          email: userEmail,
          success: false,
          hasUpdates: false,
          updateCount: 0,
          error: error.message,
        }
        results.push(result)
        errors.push(result)
        console.error(`❌ Failed for ${userEmail}: ${error.message}`)
      }
    }

    const summary: QueueSummary = {
      totalUsers: subscribers?.length || 0,
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

// Helper: Compare versions
function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  const parseVersion = (v: string) => {
    const cleaned = v.replace(/^[vr]/i, '').split('-')[0]
    return cleaned.split('.').map(p => parseInt(p, 10) || 0)
  }

  const newParts = parseVersion(newVersion)
  const currentParts = parseVersion(currentVersion)

  for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
    const n = newParts[i] || 0
    const c = currentParts[i] || 0
    if (n > c) return true
    if (n < c) return false
  }
  return false
}

// Helper: Calculate scheduled time for 8am in user's timezone
// Returns the next occurrence based on frequency:
// - daily: next 8 AM (today if before 8 AM, tomorrow if after)
// - weekly: next Monday at 8 AM
// - monthly: next 1st of month at 8 AM
function calculateScheduledTime(timezone: string, hour: number, frequency: string): Date {
  try {
    const now = new Date()

    // Get current time components in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0'

    const userNow = {
      year: parseInt(getValue('year')),
      month: parseInt(getValue('month')),
      day: parseInt(getValue('day')),
      hour: parseInt(getValue('hour')),
    }

    // Start with today in user's timezone
    let targetDate = new Date(Date.UTC(userNow.year, userNow.month - 1, userNow.day))

    // Calculate target date based on frequency
    if (frequency === 'daily') {
      // If current hour >= target hour, move to tomorrow
      if (userNow.hour >= hour) {
        targetDate.setUTCDate(targetDate.getUTCDate() + 1)
      }
    } else if (frequency === 'weekly') {
      // Find next Monday
      const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      })
      const dayOfWeek = weekdayFormatter.format(now)
      const dayNum = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[dayOfWeek] || 0

      let daysToAdd = 0
      if (dayNum === 1) {
        // It's Monday
        if (userNow.hour >= hour) {
          daysToAdd = 7 // Past target hour, schedule for next Monday
        } else {
          daysToAdd = 0 // Before target hour, schedule for today
        }
      } else if (dayNum === 0) {
        // Sunday
        daysToAdd = 1
      } else {
        // Tuesday-Saturday: days until next Monday
        daysToAdd = (8 - dayNum) % 7
      }

      targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd)
    } else if (frequency === 'monthly') {
      // Find next 1st of month
      if (userNow.day === 1 && userNow.hour < hour) {
        // It's the 1st and before target hour - keep current date
      } else {
        // Schedule for 1st of next month
        targetDate = new Date(Date.UTC(userNow.year, userNow.month, 1))
      }
    }

    // Build target time string in local timezone
    const targetYear = targetDate.getUTCFullYear()
    const targetMonth = targetDate.getUTCMonth() + 1
    const targetDay = targetDate.getUTCDate()
    const localTimeStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`

    // Get timezone offset at target date
    const testDate = new Date(`${localTimeStr}Z`)
    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const offsetParts = offsetFormatter.formatToParts(testDate)
    const offsetPart = offsetParts.find(p => p.type === 'timeZoneName')?.value || ''

    const offsetMatch = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    if (offsetMatch) {
      const sign = offsetMatch[1] === '+' ? 1 : -1
      const offsetHours = parseInt(offsetMatch[2], 10)
      const offsetMins = parseInt(offsetMatch[3] || '0', 10)
      const totalOffsetMins = sign * (offsetHours * 60 + offsetMins)

      // Convert local time to UTC by subtracting offset
      // Example: 08:00 GMT+5 = 03:00 UTC
      // Example: 08:00 GMT-5 = 13:00 UTC
      const utcDate = new Date(`${localTimeStr}Z`)
      utcDate.setMinutes(utcDate.getMinutes() - totalOffsetMins)

      console.log(`📅 Scheduled for ${timezone}: ${localTimeStr} (local) = ${utcDate.toISOString()} (UTC)`)
      return utcDate
    }

    // Fallback: interpret as UTC
    return new Date(`${localTimeStr}Z`)
  } catch (error) {
    console.error('Error calculating scheduled time:', error)
    // Fallback: 8 hours from now
    const fallback = new Date()
    fallback.setHours(fallback.getHours() + 8)
    return fallback
  }
}
