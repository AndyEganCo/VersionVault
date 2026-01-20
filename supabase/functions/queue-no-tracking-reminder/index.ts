// Supabase Edge Function for queuing no-tracking reminder emails
// Triggered by cron job on the 14th of each month at 6-8 PM to prepare for 15th 8 AM sends
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCurrentVersionFromHistory } from '../_shared/version-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants
const POPULAR_SOFTWARE_LIMIT = 5

// Random subject lines that will be picked for each user
const SUBJECT_LINES = [
  "We saved you a seat, but you forgot the software",
  "Your software tracker is feeling lonely",
  "Pop quiz: How many apps are you tracking? (Hint: it's zero)",
  "Your watchlist called—it wants some software to track",
  "Houston, we have zero software tracked",
]

interface QueueResult {
  userId: string
  email: string
  success: boolean
  error?: string
}

interface QueueSummary {
  totalUsers: number
  queued: number
  skipped: number
  errors: QueueResult[]
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to queue-no-tracking-reminder`)

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

    console.log(`📬 Starting no-tracking reminder queue generation...`)

    // Get users who have email notifications enabled
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, timezone')
      .eq('email_notifications', true)

    if (settingsError) {
      throw new Error(`Failed to fetch user settings: ${settingsError.message}`)
    }

    if (!userSettings || userSettings.length === 0) {
      console.log(`📋 No users found with email notifications enabled`)
      return new Response(
        JSON.stringify({
          totalUsers: 0,
          queued: 0,
          skipped: 0,
          errors: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user emails from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      throw new Error(`Failed to fetch user emails: ${authError.message}`)
    }

    // Create a map of user_id -> email
    const userEmailMap = new Map(
      authUsers.users.map(u => [u.id, u.email])
    )

    // Combine user settings with emails
    const usersWithNotifications = userSettings
      .map(settings => ({
        user_id: settings.user_id,
        timezone: settings.timezone,
        email: userEmailMap.get(settings.user_id)
      }))
      .filter(user => user.email) // Only keep users with valid emails

    console.log(`📋 Found ${usersWithNotifications.length} users with email notifications enabled`)

    const results: QueueResult[] = []
    const errors: QueueResult[] = []
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

    // Get popular software (most tracked)
    const { data: popularSoftwareData } = await supabase
      .rpc('get_popular_software', { limit_count: POPULAR_SOFTWARE_LIMIT })

    // Fallback query if RPC doesn't exist
    let popularSoftware = popularSoftwareData
    if (!popularSoftware) {
      const { data: fallbackData } = await supabase
        .from('tracked_software')
        .select('software_id, software:software_id (id, name, manufacturer, category)')
        .limit(1000)

      if (fallbackData) {
        // Count occurrences of each software_id
        const softwareCounts = new Map<string, any>()
        for (const item of fallbackData) {
          const software = item.software as any
          if (software) {
            const count = softwareCounts.get(software.id)?.tracker_count || 0
            softwareCounts.set(software.id, {
              software_id: software.id,
              name: software.name,
              manufacturer: software.manufacturer,
              category: software.category,
              tracker_count: count + 1,
            })
          }
        }

        // Convert to array and sort by tracker_count
        const popularSoftwareList = Array.from(softwareCounts.values())
          .sort((a, b) => b.tracker_count - a.tracker_count)
          .slice(0, POPULAR_SOFTWARE_LIMIT)

        // Fetch version history for popular software to compute current_version
        const popularSoftwareIds = popularSoftwareList.map(s => s.software_id)
        if (popularSoftwareIds.length > 0) {
          const { data: versionHistoryData } = await supabase
            .from('software_version_history')
            .select('software_id, version, release_date, detected_at, newsletter_verified, is_current_override')
            .in('software_id', popularSoftwareIds)
            .eq('newsletter_verified', true)

          // Group versions by software_id
          const versionsBySoftware = new Map<string, any[]>()
          for (const version of (versionHistoryData || [])) {
            if (!versionsBySoftware.has(version.software_id)) {
              versionsBySoftware.set(version.software_id, [])
            }
            versionsBySoftware.get(version.software_id)!.push(version)
          }

          // Add computed current_version to each software
          popularSoftware = popularSoftwareList.map(s => {
            const versions = versionsBySoftware.get(s.software_id) || []
            const currentVer = getCurrentVersionFromHistory(versions, true)
            return {
              ...s,
              current_version: currentVer?.version || 'N/A',
            }
          })
        } else {
          popularSoftware = popularSoftwareList
        }
      }
    }

    // Process each user
    for (const user of usersWithNotifications) {
      const userEmail = user.email
      if (!userEmail) {
        skipped++
        continue
      }

      try {
        // Check bounce count
        const { count: bounceCount } = await supabase
          .from('email_bounces')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id)
          .eq('bounce_type', 'hard')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        if ((bounceCount || 0) >= 3) {
          console.log(`⏭️  Skipping ${userEmail} - too many bounces`)
          skipped++
          continue
        }

        // Check if user has any tracked software
        const { count: trackedCount } = await supabase
          .from('tracked_software')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.user_id)

        if ((trackedCount || 0) > 0) {
          console.log(`⏭️  Skipping ${userEmail} - already tracking ${trackedCount} software`)
          skipped++
          continue
        }

        // Generate idempotency key
        const today = new Date()
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        const idempotencyKey = `${user.user_id}-no_tracking_reminder-${yearMonth}`

        // Calculate scheduled time (8am on 15th in user's timezone)
        const scheduledFor = calculateScheduledTime(user.timezone || 'America/New_York', 8)

        // Pick a random subject line for this user
        const subjectLine = SUBJECT_LINES[Math.floor(Math.random() * SUBJECT_LINES.length)]

        // Create payload
        const payload = {
          popularSoftware: popularSoftware || [],
          sponsor: sponsorData,
          subject_line: subjectLine, // Store the subject line in payload
        }

        // Insert into queue
        const { error: insertError } = await supabase
          .from('newsletter_queue')
          .upsert({
            user_id: user.user_id,
            email: userEmail,
            email_type: 'no_tracking_reminder',
            payload,
            status: 'pending',
            scheduled_for: scheduledFor.toISOString(),
            timezone: user.timezone || 'America/New_York',
            idempotency_key: idempotencyKey,
          }, {
            onConflict: 'idempotency_key',
            ignoreDuplicates: true,
          })

        if (insertError) {
          throw new Error(insertError.message)
        }

        results.push({
          userId: user.user_id,
          email: userEmail,
          success: true,
        })

        console.log(`✅ Queued for ${userEmail}`)

      } catch (error) {
        const result: QueueResult = {
          userId: user.user_id,
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
      totalUsers: usersWithNotifications?.length || 0,
      queued: results.filter(r => r.success).length,
      skipped,
      errors,
    }

    console.log('\n✅ Queue generation complete!')
    console.log(`   Total users: ${summary.totalUsers}`)
    console.log(`   Queued: ${summary.queued}`)
    console.log(`   Skipped: ${summary.skipped}`)
    console.log(`   Errors: ${summary.errors.length}`)

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in queue-no-tracking-reminder:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper: Calculate scheduled time for 8am on the 15th in user's timezone
function calculateScheduledTime(timezone: string, hour: number): Date {
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

    // Find next 15th
    if (userNow.day === 15 && userNow.hour < hour) {
      // It's the 15th and before target hour - keep current date
    } else {
      // Schedule for 15th of next month
      targetDate = new Date(Date.UTC(userNow.year, userNow.month, 15))
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
