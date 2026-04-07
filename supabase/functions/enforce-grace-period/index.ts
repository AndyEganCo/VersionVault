// Supabase Edge Function for enforcing freemium grace periods
// Run daily via cron or manual trigger
// - Sends warning emails at day 0, 15, 27, and 30
// - Auto-untracks oldest apps beyond 5 when grace period expires
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const FREE_TIER_TRACKING_LIMIT = 5
const GRACE_PERIOD_DAYS = 30
const VERSIONVAULT_FROM = 'VersionVault <updates@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

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
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not set — emails will be logged only')
    }

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
        await sendGracePeriodEmail(resend, userEmail, 'start', trackedCount ?? 0, GRACE_PERIOD_DAYS)
        emailsSent.push('day_0')
        results.emailsSent++
      }

      // Day 15: Midpoint reminder
      if (daysSinceStart >= 15 && !emailsSent.includes('day_15')) {
        await sendGracePeriodEmail(resend, userEmail, 'reminder', trackedCount ?? 0, GRACE_PERIOD_DAYS - daysSinceStart)
        emailsSent.push('day_15')
        results.emailsSent++
      }

      // Day 27: Final warning
      if (daysSinceStart >= 27 && !emailsSent.includes('day_27')) {
        await sendGracePeriodEmail(resend, userEmail, 'final_warning', trackedCount ?? 0, GRACE_PERIOD_DAYS - daysSinceStart)
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
            resend,
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
  resend: Resend | null,
  email: string,
  type: 'start' | 'reminder' | 'final_warning',
  trackedCount: number,
  daysLeft: number
) {
  const subjects = {
    start: `Heads up: you're tracking ${trackedCount} apps on the free plan`,
    reminder: `${daysLeft} days left to reduce your tracked apps`,
    final_warning: `Final reminder: ${daysLeft} days until auto-removal`,
  }
  const headlines = {
    start: `You're tracking ${trackedCount} apps — free plan allows ${FREE_TIER_TRACKING_LIMIT}`,
    reminder: `${daysLeft} days left in your grace period`,
    final_warning: `Last chance: ${daysLeft} days until we auto-remove your oldest apps`,
  }
  const subject = subjects[type]
  const headline = headlines[type]

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;">
    <h1 style="font-size:22px;margin:0 0 16px;">${headline}</h1>
    <p>VersionVault recently introduced a free tier with a limit of <strong>${FREE_TIER_TRACKING_LIMIT} tracked apps</strong>. You're currently tracking <strong>${trackedCount}</strong>.</p>
    <p>You have <strong>${daysLeft} days</strong> to either reduce your tracked apps to ${FREE_TIER_TRACKING_LIMIT} or upgrade to Pro. After that, we'll automatically remove your oldest tracked apps beyond the limit.</p>
    <p style="margin:24px 0;">
      <a href="${VERSIONVAULT_URL}/dashboard" style="background:#0f172a;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-right:8px;">Manage tracked apps</a>
      <a href="${VERSIONVAULT_URL}/premium" style="background:#f59e0b;color:#0f172a;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Upgrade to Pro — $25/yr</a>
    </p>
    <p style="font-size:12px;color:#64748b;margin-top:32px;">VersionVault · <a href="${VERSIONVAULT_URL}/unsubscribe" style="color:#64748b;">Unsubscribe</a></p>
  </body></html>`

  const text = `${headline}\n\nVersionVault recently introduced a free tier with a limit of ${FREE_TIER_TRACKING_LIMIT} tracked apps. You're currently tracking ${trackedCount}.\n\nYou have ${daysLeft} days to reduce your tracked apps or upgrade to Pro.\n\nManage apps: ${VERSIONVAULT_URL}/dashboard\nUpgrade: ${VERSIONVAULT_URL}/premium\n`

  if (!resend) {
    console.log(`📧 [dry-run] ${type} → ${email} (${trackedCount} apps, ${daysLeft} days)`)
    return
  }
  const { error } = await resend.emails.send({ from: VERSIONVAULT_FROM, to: email, subject, html, text })
  if (error) console.error(`❌ grace period ${type} send failed for ${email}:`, error)
  else console.log(`✅ Sent grace period ${type} email to ${email}`)
}

async function sendGracePeriodExpiredEmail(
  resend: Resend | null,
  email: string,
  keptApps: string[],
  removedApps: string[]
) {
  const subject = `We removed ${removedApps.length} apps from your tracking list`
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;">
    <h1 style="font-size:22px;margin:0 0 16px;">Your grace period ended</h1>
    <p>Your 30-day grace period has ended. Since you were still tracking more than ${FREE_TIER_TRACKING_LIMIT} apps on the free plan, we've automatically removed your oldest tracked apps beyond the limit.</p>
    <h3 style="font-size:16px;margin:24px 0 8px;">Still tracking (${keptApps.length}):</h3>
    <ul>${keptApps.map(n => `<li>${n}</li>`).join('')}</ul>
    <h3 style="font-size:16px;margin:24px 0 8px;">Removed (${removedApps.length}):</h3>
    <ul>${removedApps.map(n => `<li>${n}</li>`).join('')}</ul>
    <p>You can re-track any of these instantly by upgrading to Pro.</p>
    <p style="margin:24px 0;">
      <a href="${VERSIONVAULT_URL}/premium" style="background:#f59e0b;color:#0f172a;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Upgrade to Pro — $25/yr</a>
    </p>
    <p style="font-size:12px;color:#64748b;margin-top:32px;">VersionVault · <a href="${VERSIONVAULT_URL}/unsubscribe" style="color:#64748b;">Unsubscribe</a></p>
  </body></html>`

  const text = `Your grace period ended.\n\nStill tracking: ${keptApps.join(', ')}\nRemoved: ${removedApps.join(', ')}\n\nUpgrade: ${VERSIONVAULT_URL}/premium\n`

  if (!resend) {
    console.log(`📧 [dry-run] expired → ${email} (kept ${keptApps.length}, removed ${removedApps.length})`)
    return
  }
  const { error } = await resend.emails.send({ from: VERSIONVAULT_FROM, to: email, subject, html, text })
  if (error) console.error(`❌ grace period expired send failed for ${email}:`, error)
  else console.log(`✅ Sent grace period expired email to ${email}`)
}
