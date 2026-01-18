// Supabase Edge Function for queuing weekly digest emails
// Triggered by cron job on Sunday evening to prepare Monday's emails
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compareVersions, getCurrentVersionFromHistory } from '../_shared/version-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

interface QueueSummary {
  totalUsers: number
  queued: number
  withUpdates: number
  allQuiet: number
  skipped: number
  errors: QueueResult[]
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to queue-weekly-digest`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const customSecretHeader = req.headers.get('X-Cron-Secret')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get frequency from query parameter or request body, default to weekly
    let frequency = 'weekly'

    // First try query parameter (more reliable)
    const url = new URL(req.url)
    const queryFrequency = url.searchParams.get('frequency')
    if (queryFrequency) {
      frequency = queryFrequency
      console.log(`✅ Frequency from query param: ${frequency}`)
    } else {
      // Fallback to request body
      try {
        const body = await req.json()
        if (body && body.frequency) {
          frequency = body.frequency
          console.log(`✅ Frequency from request body: ${frequency}`)
        }
      } catch (error) {
        console.log('No frequency specified, using default: weekly')
        // No body or invalid JSON, use default weekly
      }
    }

    console.log(`📬 Starting ${frequency} digest queue generation...`)

    // Calculate days to look back based on frequency
    const sinceDays = frequency === 'daily' ? 1 : frequency === 'monthly' ? 30 : 7

    // Get users who want this frequency of emails
    const { data: userSettings, error: subError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, all_quiet_preference')
      .eq('email_notifications', true)
      .eq('notification_frequency', frequency)

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

    // Get active sponsor
    const { data: sponsor } = await supabase
      .from('newsletter_sponsors')
      .select('*')
      .eq('is_active', true)
      .single()

    const sponsorData = sponsor ? {
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
        // Check bounce count
        const { count: bounceCount } = await supabase
          .from('email_bounces')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', sub.user_id)
          .eq('bounce_type', 'hard')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if ((bounceCount || 0) >= 3) {
          console.log(`⏭️  Skipping ${userEmail} - too many bounces`)
          skipped++
          continue
        }

        // Get user's tracked software
        const { data: trackedSoftwareRaw } = await supabase
          .from('tracked_software')
          .select('software_id, last_notified_version')
          .eq('user_id', sub.user_id)

        if (!trackedSoftwareRaw || trackedSoftwareRaw.length === 0) {
          console.log(`⏭️  Skipping ${userEmail} - no tracked software`)
          skipped++
          continue
        }

        // Get software details separately
        const softwareIds = trackedSoftwareRaw.map(t => t.software_id)
        const { data: softwareDetails } = await supabase
          .from('software')
          .select('id, name, manufacturer, category')
          .in('id', softwareIds)

        // Map software details
        const softwareMap = new Map(
          (softwareDetails || []).map(s => [s.id, s])
        )

        // Combine tracked software with details
        const trackedSoftware = trackedSoftwareRaw.map(tracked => ({
          software_id: tracked.software_id,
          last_notified_version: tracked.last_notified_version,
          software: softwareMap.get(tracked.software_id)
        }))

        // Get ALL verified version history for tracked software
        // We need the full history to find the current and previous versions
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - sinceDays)

        // Fetch version history - order by detected_at DESC to get newest first
        // Supabase has a hard limit of 1000 rows, so ordering ensures we get recent versions
        const { data: allVersionHistory, error: versionHistoryError } = await supabase
          .from('software_version_history')
          .select('software_id, version, release_date, detected_at, notes, type, newsletter_verified')
          .in('software_id', softwareIds)
          .eq('newsletter_verified', true)
          .order('detected_at', { ascending: false })
          .limit(10000)

        if (versionHistoryError) {
          console.error(`❌ Error fetching version history for ${userEmail}:`, versionHistoryError)
          throw new Error(`Failed to fetch version history: ${versionHistoryError.message}`)
        }

        console.log(`📊 Fetched ${allVersionHistory?.length || 0} total version history records for ${userEmail} (Supabase max is 1000)`)

        // Group version history by software_id and sort by SEMANTIC VERSION (not date!)
        const versionHistoryBySoftware = new Map<string, any[]>()
        for (const history of (allVersionHistory || [])) {
          if (!versionHistoryBySoftware.has(history.software_id)) {
            versionHistoryBySoftware.set(history.software_id, [])
          }
          versionHistoryBySoftware.get(history.software_id)!.push(history)
        }

        // Sort each software's version history by semantic version (highest first)
        for (const [softwareId, histories] of versionHistoryBySoftware.entries()) {
          histories.sort((a, b) => compareVersions(b.version, a.version))
          versionHistoryBySoftware.set(softwareId, histories)
        }

        // Process each tracked software to find updates
        const updates: any[] = []

        for (const tracked of trackedSoftware) {
          const software = tracked.software as any
          if (!software) continue

          const histories = versionHistoryBySoftware.get(tracked.software_id) || []
          if (histories.length === 0) continue

          // Get current version from history using semantic versioning (highest version = current)
          // This is the single source of truth, NOT software.current_version field
          const currentVersion = getCurrentVersionFromHistory(histories, true)
          if (!currentVersion) continue

          // Check if the current version was released in the time period
          const releaseDate = currentVersion.release_date || currentVersion.detected_at
          const releaseDateObj = new Date(releaseDate)
          if (releaseDateObj < sinceDate) {
            // Current version was released before the time period, skip
            continue
          }

          // Find the previous version (the next one in the semantically sorted array)
          const currentIndex = histories.indexOf(currentVersion)
          const previousVersionEntry = currentIndex < histories.length - 1 ? histories[currentIndex + 1] : null

          // Determine old version
          const oldVersion = previousVersionEntry?.version || tracked.last_notified_version || 'N/A'

          updates.push({
            software_id: tracked.software_id,
            name: software.name,
            manufacturer: software.manufacturer,
            category: software.category,
            old_version: oldVersion,
            new_version: currentVersion.version,
            release_date: releaseDate,
            release_notes: currentVersion.notes || [],
            update_type: currentVersion.type || 'patch',
          })
        }

        // Show all updates (no limit)
        const hasUpdates = updates.length > 0

        // Get new software added in the time period
        const { data: newSoftwareData } = await supabase
          .from('software')
          .select('id, name, manufacturer, category, created_at')
          .gte('created_at', sinceDate.toISOString())
          .order('created_at', { ascending: false })

        // Get version history for all new software to compute current version
        const newSoftwareIds = (newSoftwareData || []).map(s => s.id)
        let newSoftwareVersions: any[] = []

        if (newSoftwareIds.length > 0) {
          const { data } = await supabase
            .from('software_version_history')
            .select('software_id, version, release_date, detected_at, newsletter_verified, is_current_override')
            .in('software_id', newSoftwareIds)
            .eq('newsletter_verified', true)

          newSoftwareVersions = data || []
        }

        // Group versions by software_id
        const newSoftwareVersionsBySoftware = new Map<string, any[]>()
        for (const version of newSoftwareVersions) {
          if (!newSoftwareVersionsBySoftware.has(version.software_id)) {
            newSoftwareVersionsBySoftware.set(version.software_id, [])
          }
          newSoftwareVersionsBySoftware.get(version.software_id)!.push(version)
        }

        // Map to newSoftware with computed current version
        const newSoftware = (newSoftwareData || []).map(s => {
          const versions = newSoftwareVersionsBySoftware.get(s.id) || []
          const currentVer = getCurrentVersionFromHistory(versions, true)

          return {
            software_id: s.id,
            name: s.name,
            manufacturer: s.manufacturer,
            category: s.category,
            initial_version: currentVer?.version || 'N/A',
            added_date: s.created_at,
          }
        })

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

        // Generate idempotency key
        const today = new Date().toISOString().split('T')[0]
        const idempotencyKey = `${sub.user_id}-${frequency}_digest-${today}`

        // Calculate scheduled time (8am in user's timezone - next occurrence)
        const scheduledFor = calculateScheduledTime(sub.timezone || 'America/New_York', 8, frequency)

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
