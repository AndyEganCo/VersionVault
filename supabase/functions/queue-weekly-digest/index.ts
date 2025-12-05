// Supabase Edge Function for queuing weekly digest emails
// Triggered by cron job on Sunday evening to prepare Monday's emails
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    console.log('📬 Starting weekly digest queue generation...')

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get frequency from request body or default to weekly
    let frequency = 'weekly'
    try {
      const body = await req.json()
      if (body.frequency) frequency = body.frequency
    } catch {
      // No body, use default
    }

    // Calculate days to look back based on frequency
    const sinceDays = frequency === 'daily' ? 1 : frequency === 'monthly' ? 30 : 7

    // Get users who want this frequency of emails
    const { data: subscribers, error: subError } = await supabase
      .from('user_settings')
      .select(`
        user_id,
        timezone,
        users:user_id (
          email
        )
      `)
      .eq('email_notifications', true)
      .eq('notification_frequency', frequency)

    if (subError) {
      throw new Error(`Failed to fetch subscribers: ${subError.message}`)
    }

    console.log(`📋 Found ${subscribers?.length || 0} subscribers for ${frequency} digest`)

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
    for (const sub of (subscribers || [])) {
      const userEmail = (sub.users as { email: string } | null)?.email
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
        const { data: trackedSoftware } = await supabase
          .from('tracked_software')
          .select(`
            software_id,
            last_notified_version,
            software:software_id (
              id,
              name,
              manufacturer,
              category,
              current_version
            )
          `)
          .eq('user_id', sub.user_id)

        if (!trackedSoftware || trackedSoftware.length === 0) {
          console.log(`⏭️  Skipping ${userEmail} - no tracked software`)
          skipped++
          continue
        }

        // Get version history for tracked software
        const softwareIds = trackedSoftware.map(t => t.software_id)
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - sinceDays)

        const { data: versionHistory } = await supabase
          .from('software_version_history')
          .select('software_id, version, release_date, detected_at, notes, type')
          .in('software_id', softwareIds)
          .gte('detected_at', sinceDate.toISOString())
          .order('detected_at', { ascending: false })

        // Build updates list
        const updates: any[] = []
        const processedSoftware = new Set<string>()

        for (const history of (versionHistory || [])) {
          if (processedSoftware.has(history.software_id)) continue

          const tracked = trackedSoftware.find(t => t.software_id === history.software_id)
          if (!tracked?.software) continue

          const software = tracked.software as any
          const lastNotified = tracked.last_notified_version

          // Skip if this isn't newer than what we last notified about
          if (lastNotified && !isNewerVersion(history.version, lastNotified)) {
            continue
          }

          updates.push({
            software_id: history.software_id,
            name: software.name,
            manufacturer: software.manufacturer,
            category: software.category,
            old_version: lastNotified || '?.?.?',
            new_version: history.version,
            release_date: history.release_date || history.detected_at,
            release_notes: history.notes || [],
            update_type: history.type || 'patch',
          })

          processedSoftware.add(history.software_id)
        }

        // Limit updates
        const limitedUpdates = updates.slice(0, MAX_UPDATES_PER_EMAIL)
        const hasUpdates = limitedUpdates.length > 0

        // Generate idempotency key
        const today = new Date().toISOString().split('T')[0]
        const idempotencyKey = `${sub.user_id}-${frequency}_digest-${today}`

        // Calculate scheduled time (8am in user's timezone tomorrow)
        const scheduledFor = calculateScheduledTime(sub.timezone || 'America/New_York', 8)

        // Determine email type and payload
        const emailType = hasUpdates ? `${frequency}_digest` : 'all_quiet'
        const payload = {
          updates: limitedUpdates,
          sponsor: sponsorData,
          all_quiet_message: hasUpdates ? undefined : ALL_QUIET_MESSAGES[Math.floor(Math.random() * ALL_QUIET_MESSAGES.length)],
          tracked_count: trackedSoftware.length,
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
          updateCount: limitedUpdates.length,
        })

        console.log(`✅ Queued for ${userEmail}: ${limitedUpdates.length} updates`)

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
function calculateScheduledTime(timezone: string, hour: number): Date {
  const now = new Date()

  // Get tomorrow's date
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Set to target hour in UTC, then adjust for timezone
  // This is a simplified approach - for production, use a proper timezone library
  try {
    // Create a date string for tomorrow at the target hour
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')

    // Parse timezone offset (simplified - assumes IANA timezone names)
    // For production, use a proper library like date-fns-tz
    const targetDate = new Date(`${year}-${month}-${day}T${String(hour).padStart(2, '0')}:00:00`)

    // Get the timezone offset for the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(targetDate)
    const offsetPart = parts.find(p => p.type === 'timeZoneName')

    if (offsetPart) {
      // Parse offset like "GMT-5" or "GMT+5:30"
      const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
      if (match) {
        const sign = match[1] === '+' ? 1 : -1
        const hours = parseInt(match[2], 10)
        const minutes = parseInt(match[3] || '0', 10)
        const offsetMinutes = sign * (hours * 60 + minutes)

        // Adjust to UTC
        targetDate.setMinutes(targetDate.getMinutes() - offsetMinutes)
      }
    }

    return targetDate
  } catch {
    // Fallback: return tomorrow at 8am UTC
    const fallback = new Date(tomorrow)
    fallback.setUTCHours(hour, 0, 0, 0)
    return fallback
  }
}
