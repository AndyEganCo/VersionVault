// Supabase Edge Function for enforcing freemium grace periods
// Run daily via cron or manual trigger
// - Sends warning emails at day 0, 15, 27, and 30
// - Auto-untracks oldest apps beyond 5 when grace period expires
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FREE_TIER_TRACKING_LIMIT = 5
const GRACE_PERIOD_DAYS = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to enforce-grace-period`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find VersionVault software ID — it's excluded from the tracking limit
    const { data: vvData } = await supabase
      .from('software')
      .select('id, name')
      .or('name.ilike.%versionvault%,name.ilike.%version vault%')

    const versionVaultId = vvData?.find((s: any) =>
      s.name.toLowerCase().includes('versionvault') ||
      s.name.toLowerCase().includes('version vault')
    )?.id ?? null

    // Get all users with active grace periods
    const { data: usersInGrace, error: fetchError } = await supabase
      .from('user_settings')
      .select('user_id, grace_period_start, grace_period_emails_sent')
      .not('grace_period_start', 'is', null)

    if (fetchError) throw fetchError

    const now = new Date()
    const results = { expired: 0, emailsSent: 0, skipped: 0 }

    for (const userSettings of usersInGrace || []) {
      const gracePeriodStart = new Date(userSettings.grace_period_start)
      const daysSinceStart = Math.floor((now.getTime() - gracePeriodStart.getTime()) / (24 * 60 * 60 * 1000))
      const emailsSent: string[] = userSettings.grace_period_emails_sent || []

      // Check if user is now premium (skip them)
      const { data: premiumCheck } = await supabase
        .from('premium_users')
        .select('user_id')
        .eq('user_id', userSettings.user_id)
        .maybeSingle()

      if (premiumCheck) {
        // User upgraded during grace period — clear grace period
        await supabase
          .from('user_settings')
          .update({ grace_period_start: null, grace_period_emails_sent: [] })
          .eq('user_id', userSettings.user_id)
        results.skipped++
        continue
      }

      // Get user's tracked software count (excluding VersionVault)
      let countQuery = supabase
        .from('tracked_software')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userSettings.user_id)
      if (versionVaultId) {
        countQuery = countQuery.neq('software_id', versionVaultId)
      }
      const { count: trackedCount } = await countQuery

      // If user already reduced to <=5, clear grace period
      if ((trackedCount ?? 0) <= FREE_TIER_TRACKING_LIMIT) {
        await supabase
          .from('user_settings')
          .update({ grace_period_start: null, grace_period_emails_sent: [] })
          .eq('user_id', userSettings.user_id)
        results.skipped++
        continue
      }

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userSettings.user_id)
      const userEmail = userData?.user?.email

      if (!userEmail) continue

      // Day 0: Start email
      if (daysSinceStart >= 0 && !emailsSent.includes('day_0')) {
        await sendGracePeriodEmail(userEmail, 'start', trackedCount ?? 0, GRACE_PERIOD_DAYS)
        emailsSent.push('day_0')
        results.emailsSent++
      }

      // Day 15: Midpoint reminder
      if (daysSinceStart >= 15 && !emailsSent.includes('day_15')) {
        await sendGracePeriodEmail(userEmail, 'reminder', trackedCount ?? 0, GRACE_PERIOD_DAYS - daysSinceStart)
        emailsSent.push('day_15')
        results.emailsSent++
      }

      // Day 27: Final warning
      if (daysSinceStart >= 27 && !emailsSent.includes('day_27')) {
        await sendGracePeriodEmail(userEmail, 'final_warning', trackedCount ?? 0, GRACE_PERIOD_DAYS - daysSinceStart)
        emailsSent.push('day_27')
        results.emailsSent++
      }

      // Day 30: Expire — auto-untrack oldest apps beyond 5
      if (daysSinceStart >= GRACE_PERIOD_DAYS) {
        // Get tracked apps ordered by created_at DESC (keep newest 5)
        const { data: allTrackedApps } = await supabase
          .from('tracked_software')
          .select('id, software_id, created_at')
          .eq('user_id', userSettings.user_id)
          .order('created_at', { ascending: false })

        // Always keep VersionVault (doesn't count toward limit)
        const vvTracked = (allTrackedApps || []).filter((a: any) => a.software_id === versionVaultId)
        const trackedApps = (allTrackedApps || []).filter((a: any) => a.software_id !== versionVaultId)

        if (trackedApps.length > FREE_TIER_TRACKING_LIMIT) {
          const toRemove = trackedApps.slice(FREE_TIER_TRACKING_LIMIT)
          const removeIds = toRemove.map(app => app.id)

          // Get software names for the email
          const keptApps = trackedApps.slice(0, FREE_TIER_TRACKING_LIMIT)
          const { data: keptSoftware } = await supabase
            .from('software')
            .select('name')
            .in('id', keptApps.map(a => a.software_id))

          const { data: removedSoftware } = await supabase
            .from('software')
            .select('name')
            .in('id', toRemove.map(a => a.software_id))

          // Delete the oldest tracked apps
          await supabase
            .from('tracked_software')
            .delete()
            .in('id', removeIds)

          // Send expiration email
          await sendGracePeriodExpiredEmail(
            userEmail,
            keptSoftware?.map(s => s.name) || [],
            removedSoftware?.map(s => s.name) || []
          )

          // Clear grace period
          await supabase
            .from('user_settings')
            .update({ grace_period_start: null, grace_period_emails_sent: [] })
            .eq('user_id', userSettings.user_id)

          results.expired++
        }

        continue
      }

      // Update emails sent
      await supabase
        .from('user_settings')
        .update({ grace_period_emails_sent: emailsSent })
        .eq('user_id', userSettings.user_id)
    }

    console.log(`✅ Grace period enforcement complete:`, results)

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error enforcing grace period:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendGracePeriodEmail(
  email: string,
  type: 'start' | 'reminder' | 'final_warning',
  trackedCount: number,
  daysLeft: number
) {
  // TODO: Integrate with Resend email service
  console.log(`📧 Sending grace period ${type} email to ${email} (${trackedCount} apps, ${daysLeft} days left)`)
}

async function sendGracePeriodExpiredEmail(
  email: string,
  keptApps: string[],
  removedApps: string[]
) {
  // TODO: Integrate with Resend email service
  console.log(`📧 Sending grace period expired email to ${email} (kept: ${keptApps.join(', ')}, removed: ${removedApps.join(', ')})`)
}
