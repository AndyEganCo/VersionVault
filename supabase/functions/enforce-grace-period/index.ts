// Supabase Edge Function for enforcing freemium grace periods
// Run daily via cron or manual trigger
// - Sends warning emails at day 0, 15, 27, and 30
// - Auto-untracks oldest apps beyond 5 when grace period expires
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import { throttledResendSend } from '../_shared/resend-throttle.ts'

const FREE_TIER_TRACKING_LIMIT = 5
const GRACE_PERIOD_DAYS = 30
const VERSIONVAULT_FROM = 'VersionVault <updates@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

// Reason a user is in a grace/winddown period. Same templates serve all four:
// - subscription_ending: Pro user with a known cancellation date in the future
// - subscription_ended: Pro just ended (failed payment / cancel) and they're now over the free limit
// - free_overage: Free user already over the limit (early-adopter migration case)
// - bonus_ending: Pro grant (e.g. launch_gift, referral) is ending but the user
//   is already within the free-tier limit — informational only, no enforcement
type ReminderReason = 'subscription_ending' | 'subscription_ended' | 'free_overage' | 'bonus_ending'

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

    // Test mode: send a single template to a target email without touching the DB.
    // Body: { testMode: true, testEmail: 'x@y.z', testType: 'start'|'reminder'|'final_warning'|'expired'|'bonus_ended', testReason?: 'subscription_ending'|'subscription_ended'|'free_overage'|'bonus_ending', testUserId?: string, testUserName?: string }
    let testBody: any = null
    try { testBody = await req.clone().json() } catch (_) { /* not json */ }
    if (testBody?.testMode) {
      const testEmail = testBody.testEmail
      const testType = testBody.testType
      const testReason: ReminderReason = testBody.testReason || (testType === 'expired' ? 'subscription_ended' : 'subscription_ending')
      const testUserId = testBody.testUserId || '00000000-0000-0000-0000-000000000000'
      const testUserName = testBody.testUserName || (testEmail?.split('@')[0] ?? 'there')
      if (!testEmail || !testType) {
        return new Response(JSON.stringify({ error: 'testMode requires testEmail and testType' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Look up real tracked-app count for the test user (excluding VersionVault itself)
      const { data: vvTestData } = await supabase
        .from('software')
        .select('id, name')
        .or('name.ilike.%versionvault%,name.ilike.%version vault%')
      const vvTestId = vvTestData?.find((s: any) =>
        s.name.toLowerCase().includes('versionvault') ||
        s.name.toLowerCase().includes('version vault')
      )?.id ?? null

      // Count for the test user (same pattern as production loop)
      let realCountQuery = supabase
        .from('tracked_software')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId)
      if (vvTestId) {
        realCountQuery = realCountQuery.neq('software_id', vvTestId)
      }
      const { count: realCount, error: realCountError } = await realCountQuery
      if (realCountError) console.error('test mode count query failed:', realCountError)
      console.log(`test mode: user ${testUserId} has tracked count = ${realCount}`)
      const trackedCountForTest = realCount ?? 0

      // Fetch software names (oldest first) for the expired template
      let trackedNames: string[] = []
      if (testType === 'expired' && trackedCountForTest > 0) {
        let rowsQuery = supabase
          .from('tracked_software')
          .select('software_id, created_at')
          .eq('user_id', testUserId)
          .order('created_at', { ascending: true })
        if (vvTestId) rowsQuery = rowsQuery.neq('software_id', vvTestId)
        const { data: rows } = await rowsQuery
        if (rows && rows.length > 0) {
          const swIds = rows.map((r: any) => r.software_id)
          const { data: swRows } = await supabase.from('software').select('id, name').in('id', swIds)
          const nameById = new Map((swRows ?? []).map((s: any) => [s.id, s.name]))
          trackedNames = rows.map((r: any) => nameById.get(r.software_id)).filter(Boolean) as string[]
        }
      }

      if (testType === 'expired') {
        // Mirror real expiry logic: keep oldest 5, remove the rest
        const kept = trackedNames.slice(0, FREE_TIER_TRACKING_LIMIT)
        const removed = trackedNames.slice(FREE_TIER_TRACKING_LIMIT)
        await sendGracePeriodExpiredEmail(
          resend,
          testEmail,
          testUserName,
          testUserId,
          kept.length ? kept : ['Logic Pro', 'Final Cut Pro', 'Xcode', 'Slack', 'Figma'],
          removed.length ? removed : ['Photoshop', 'Sketch', 'VS Code', 'Notion'],
          testReason === 'free_overage' ? 'free_overage' : 'subscription_ended'
        )
      } else if (testType === 'bonus_ended') {
        await sendBonusEndedEmail(resend, testEmail, testUserName, testUserId, trackedCountForTest)
      } else {
        const daysLeft = testType === 'start' ? 30 : testType === 'reminder' ? 15 : 3
        await sendGracePeriodEmail(resend, testEmail, testUserName, testUserId, testType as any, trackedCountForTest, daysLeft, testReason)
      }
      return new Response(JSON.stringify({ success: true, testMode: true, type: testType, email: testEmail, count: trackedCountForTest }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    // Find all users whose Pro access (via premium_grants) is within the
    // 30-day winddown window or already expired. These are the users we
    // need to warn or enforce against.
    //
    // Exclusions handled in the loop below:
    // - is_legacy=TRUE users (permanent Pro, no grant expiry to enforce)
    // - users with an active Stripe subscription (their Pro access comes
    //   from the subscription, not the grant)
    const windowEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    const { data: usersInWinddown, error: fetchError } = await supabase
      .from('premium_users')
      .select('user_id, granted_until, is_legacy')
      .eq('is_legacy', false)
      .not('granted_until', 'is', null)
      .lt('granted_until', windowEnd.toISOString())

    if (fetchError) throw fetchError

    const now = new Date()
    const results = { expired: 0, emailsSent: 0, skipped: 0 }

    for (const row of usersInWinddown || []) {
      const userId = row.user_id
      const grantedUntil = new Date(row.granted_until)
      const msUntilExpiry = grantedUntil.getTime() - now.getTime()
      const daysUntilExpiry = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000))

      // Skip if user has an active Stripe subscription (Pro comes from sub,
      // not the grant). Non-active rows are cleaned up by the sync trigger
      // on status change, so we only need to guard against active.
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (sub) {
        results.skipped++
        continue
      }

      // Get user's tracked software count (excluding VersionVault).
      let countQuery = supabase
        .from('tracked_software')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (versionVaultId) {
        countQuery = countQuery.neq('software_id', versionVaultId)
      }
      const { count: trackedCount } = await countQuery

      // If the user is at or under the free limit, nothing will be
      // auto-removed when the grant expires — but we still want to tell
      // them their Pro access is ending so there are no surprises. We
      // send a calmer "bonus ending" variant of the same emails instead
      // of the over-limit countdown copy.
      const isUnderLimit = (trackedCount ?? 0) <= FREE_TIER_TRACKING_LIMIT

      // Get user email & name.
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      const userEmail = userData?.user?.email
      const userName =
        userData?.user?.user_metadata?.full_name?.split(' ')?.[0] ||
        userData?.user?.user_metadata?.name?.split(' ')?.[0] ||
        userEmail?.split('@')[0] ||
        'there'

      if (!userEmail) continue

      // Determine reason for the email. We can't cheaply tell "subscription
      // just ended" from "launch gift winddown" from here, but we CAN tell
      // "already expired" from "expiring soon" and "over limit" from "under
      // limit". Under-limit users get the calm bonus_ending copy since
      // nothing will actually be removed from their account.
      const reason: ReminderReason = isUnderLimit
        ? 'bonus_ending'
        : msUntilExpiry > 0
        ? 'subscription_ending'
        : 'subscription_ended'

      // De-dupe emails per grant cycle by prefixing with the granted_until
      // date. If the user gets a fresh grant (new granted_until), the
      // prefix changes and old entries no longer match, so we start over.
      const grantKey = grantedUntil.toISOString().slice(0, 10)
      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('grace_period_emails_sent')
        .eq('user_id', userId)
        .maybeSingle()
      const emailsSent: string[] = (settingsRow?.grace_period_emails_sent || [])
        .filter((k: string) => k.startsWith(`${grantKey}:`))

      // 30 days out: start-of-winddown email
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 15 && !emailsSent.includes(`${grantKey}:day_0`)) {
        await sendGracePeriodEmail(resend, userEmail, userName, userId, 'start', trackedCount ?? 0, daysUntilExpiry, reason)
        emailsSent.push(`${grantKey}:day_0`)
        results.emailsSent++
      }

      // 15 days out: midpoint reminder
      if (daysUntilExpiry <= 15 && daysUntilExpiry > 3 && !emailsSent.includes(`${grantKey}:day_15`)) {
        await sendGracePeriodEmail(resend, userEmail, userName, userId, 'reminder', trackedCount ?? 0, daysUntilExpiry, reason)
        emailsSent.push(`${grantKey}:day_15`)
        results.emailsSent++
      }

      // 3 days out: final warning
      if (daysUntilExpiry <= 3 && daysUntilExpiry > 0 && !emailsSent.includes(`${grantKey}:day_27`)) {
        await sendGracePeriodEmail(resend, userEmail, userName, userId, 'final_warning', trackedCount ?? 0, daysUntilExpiry, reason)
        emailsSent.push(`${grantKey}:day_27`)
        results.emailsSent++
      }

      // Past expiry: handle under-limit and over-limit users differently.
      // - Under-limit: send a calm "your Pro bonus ended" confirmation, no deletion.
      // - Over-limit: auto-untrack oldest apps beyond FREE_TIER_TRACKING_LIMIT
      //   and send the kept/removed expired email.
      if (msUntilExpiry <= 0 && !emailsSent.includes(`${grantKey}:expired`)) {
        if (isUnderLimit) {
          await sendBonusEndedEmail(resend, userEmail, userName, userId, trackedCount ?? 0)
          emailsSent.push(`${grantKey}:expired`)
          results.expired++
        } else {
          const { data: allTrackedApps } = await supabase
            .from('tracked_software')
            .select('id, software_id, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

          // Always keep VersionVault (doesn't count toward limit)
          const trackedApps = (allTrackedApps || []).filter((a: any) => a.software_id !== versionVaultId)

          if (trackedApps.length > FREE_TIER_TRACKING_LIMIT) {
            const toRemove = trackedApps.slice(FREE_TIER_TRACKING_LIMIT)
            const removeIds = toRemove.map((app: any) => app.id)

            const keptApps = trackedApps.slice(0, FREE_TIER_TRACKING_LIMIT)
            const { data: keptSoftware } = await supabase
              .from('software')
              .select('name')
              .in('id', keptApps.map((a: any) => a.software_id))
            const { data: removedSoftware } = await supabase
              .from('software')
              .select('name')
              .in('id', toRemove.map((a: any) => a.software_id))

            await supabase
              .from('tracked_software')
              .delete()
              .in('id', removeIds)

            await sendGracePeriodExpiredEmail(
              resend,
              userEmail,
              userName,
              userId,
              keptSoftware?.map((s: any) => s.name) || [],
              removedSoftware?.map((s: any) => s.name) || [],
              'subscription_ended'
            )

            emailsSent.push(`${grantKey}:expired`)
            results.expired++
          }
        }
      }

      // Persist the updated emails_sent keys for this grant cycle.
      await supabase
        .from('user_settings')
        .update({ grace_period_emails_sent: emailsSent })
        .eq('user_id', userId)
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

function renderShell(label: string, userId: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
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
        ${label}
      </div>
    </div>

    ${bodyHtml}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="${VERSIONVAULT_URL}/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Manage Preferences</a>
        <span style="margin: 0 12px; color: #525252;">&bull;</span>
        <a href="${VERSIONVAULT_URL}/unsubscribe?uid=${userId}" style="color: #a3a3a3; text-decoration: underline;">Unsubscribe</a>
        <span style="margin: 0 12px; color: #525252;">&bull;</span>
        <a href="${VERSIONVAULT_URL}/dashboard" style="color: #a3a3a3; text-decoration: underline;">Open Dashboard</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault &bull; Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">&copy; ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`
}

async function sendGracePeriodEmail(
  resend: Resend | null,
  email: string,
  userName: string,
  userId: string,
  type: 'start' | 'reminder' | 'final_warning',
  trackedCount: number,
  daysLeft: number,
  reason: ReminderReason = 'subscription_ending'
) {
  // Subjects + headlines per (type, reason). All variants share the same body shell.
  const labels: Record<typeof type, Record<ReminderReason, string>> = {
    start: {
      subscription_ending: 'PRO ENDING SOON',
      subscription_ended: 'PRO HAS ENDED',
      free_overage: 'FREE PLAN NOTICE',
      bonus_ending: 'PRO BONUS ENDING',
    },
    reminder: {
      subscription_ending: 'PRO ENDING REMINDER',
      subscription_ended: 'PRO ENDED REMINDER',
      free_overage: 'GRACE PERIOD REMINDER',
      bonus_ending: 'PRO BONUS REMINDER',
    },
    final_warning: {
      subscription_ending: 'FINAL WARNING',
      subscription_ended: 'FINAL WARNING',
      free_overage: 'FINAL WARNING',
      bonus_ending: 'PRO BONUS ENDING SOON',
    },
  }
  const subjects: Record<typeof type, Record<ReminderReason, string>> = {
    start: {
      subscription_ending: `Your VersionVault Pro ends in ${daysLeft} days`,
      subscription_ended: `Your VersionVault Pro has ended`,
      free_overage: `Heads up: you're tracking ${trackedCount} apps on the free plan`,
      bonus_ending: `Your free month of VersionVault Pro ends in ${daysLeft} days`,
    },
    reminder: {
      subscription_ending: `${daysLeft} days until your Pro access ends`,
      subscription_ended: `${daysLeft} days left before we trim your tracked apps`,
      free_overage: `${daysLeft} days left to reduce your tracked apps`,
      bonus_ending: `${daysLeft} days left on your free Pro month`,
    },
    final_warning: {
      subscription_ending: `Final reminder: Pro ends in ${daysLeft} days`,
      subscription_ended: `Final reminder: ${daysLeft} days until auto-removal`,
      free_overage: `Final reminder: ${daysLeft} days until auto-removal`,
      bonus_ending: `${daysLeft} days left on your free Pro month`,
    },
  }
  const headlines: Record<typeof type, Record<ReminderReason, string>> = {
    start: {
      subscription_ending: `Your Pro subscription ends in ${daysLeft} days`,
      subscription_ended: `Your Pro subscription has ended`,
      free_overage: `You're tracking ${trackedCount} apps — free plan allows ${FREE_TIER_TRACKING_LIMIT}`,
      bonus_ending: `Your free month of Pro ends in ${daysLeft} days`,
    },
    reminder: {
      subscription_ending: `${daysLeft} days until your Pro access ends`,
      subscription_ended: `${daysLeft} days left in your winddown period`,
      free_overage: `${daysLeft} days left in your grace period`,
      bonus_ending: `${daysLeft} days left on your free Pro month`,
    },
    final_warning: {
      subscription_ending: `Last chance: Pro ends in ${daysLeft} days`,
      subscription_ended: `Last chance: ${daysLeft} days until auto-removal`,
      free_overage: `Last chance: ${daysLeft} days until auto-removal`,
      bonus_ending: `${daysLeft} days left on your free Pro month`,
    },
  }
  const intros: Record<ReminderReason, string> = {
    subscription_ending: `Your VersionVault Pro subscription is set to end soon. After it ends, the free plan allows up to <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT} tracked apps</strong>. You're currently tracking <strong style="color: #ffffff;">${trackedCount}</strong>.`,
    subscription_ended: `Your VersionVault Pro subscription has ended and you've been moved to the free plan, which allows up to <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT} tracked apps</strong>. You're currently tracking <strong style="color: #ffffff;">${trackedCount}</strong>.`,
    free_overage: `VersionVault's free plan allows <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT} tracked apps</strong>. You're currently tracking <strong style="color: #ffffff;">${trackedCount}</strong>. We wanted to give you a heads up before anything changes on your account.`,
    bonus_ending: `Just a heads up — your free month of VersionVault Pro is ending. Good news: you're tracking <strong style="color: #ffffff;">${trackedCount}</strong> app${trackedCount === 1 ? '' : 's'}, well within the free plan limit of <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT}</strong>, so nothing will change on your account. We just wanted you to know.`,
  }
  const badgeColors: Record<typeof type, string> = {
    start: '#3b82f6',
    reminder: '#f59e0b',
    final_warning: '#ef4444',
  }
  const subject = subjects[type][reason]
  const label = labels[type][reason]
  const headline = headlines[type][reason]
  const intro = intros[reason]
  // Bonus_ending is informational — keep the badge calm (blue) regardless
  // of which reminder tier it's firing on, since there's no cliff.
  const badgeColor = reason === 'bonus_ending' ? '#3b82f6' : badgeColors[type]
  // Count color: red if over limit, green if the user is already compliant.
  const countColor = trackedCount > FREE_TIER_TRACKING_LIMIT ? '#ef4444' : '#22c55e'

  const actionLine = reason === 'bonus_ending'
    ? `Nothing is going to change on your account when Pro ends — you're already within the free plan limit. If you'd like unlimited tracking back, you can <strong style="color: #ffffff;">upgrade to Pro</strong> or <strong style="color: #ffffff;">invite friends</strong> to earn more free Pro time.`
    : `You have <strong style="color: #ffffff;">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> to ${reason === 'subscription_ending' ? 'renew your Pro subscription, reduce your tracked apps to ' + FREE_TIER_TRACKING_LIMIT + ', or' : 'reduce your tracked apps to ' + FREE_TIER_TRACKING_LIMIT + ', resubscribe to Pro, or'} <strong style="color: #ffffff;">invite friends</strong> to earn free Pro time. After that, we'll automatically remove your oldest tracked apps beyond the limit.`

  const body = `
    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        ${intro}
      </div>
    </div>

    <!-- Status card -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${headline}</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: ${badgeColor}; padding: 3px 8px; border-radius: 4px;">${label}</span>
        </div>
        <div style="font-size: 14px; font-family: monospace; margin-top: 8px;">
          <span style="color: #737373;">Tracking</span>
          <span style="color: ${countColor}; font-weight: 600;"> ${trackedCount}</span>
          <span style="color: #525252;"> / </span>
          <span style="color: #22c55e; font-weight: 600;">${FREE_TIER_TRACKING_LIMIT}</span>
          <span style="color: #737373;"> allowed</span>
        </div>
        <div style="font-size: 13px; color: #a3a3a3; margin-top: 12px; line-height: 1.6;">
          ${actionLine}
        </div>
      </div>
    </div>

    <!-- Referral hint card -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px 20px;">
        <div style="font-size: 13px; color: #a3a3a3; line-height: 1.6;">
          <span style="color: #ffffff; font-weight: 600;">Don't want to pay?</span> Invite a friend and you both get <strong style="color: #ffffff;">1 free month of Pro</strong>. Stack milestone bonuses (+2 / +3 / +6 months) at 5, 10, and 25 referrals.
        </div>
      </div>
    </div>

    <!-- CTAs -->
    <div style="padding: 0 24px 32px 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/dashboard" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #262626; border: 1px solid #404040; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Manage apps</a>
      <a href="${VERSIONVAULT_URL}/user/referrals" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #262626; border: 1px solid #404040; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Invite friends</a>
      <a href="${VERSIONVAULT_URL}/premium" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Upgrade — $25/yr</a>
    </div>
  `

  const html = renderShell(label, userId, body)

  const introText = reason === 'subscription_ending'
    ? `Your VersionVault Pro subscription is set to end soon. After it ends, the free plan allows up to ${FREE_TIER_TRACKING_LIMIT} tracked apps. You're currently tracking ${trackedCount}.`
    : reason === 'subscription_ended'
    ? `Your VersionVault Pro subscription has ended and you've been moved to the free plan, which allows up to ${FREE_TIER_TRACKING_LIMIT} tracked apps. You're currently tracking ${trackedCount}.`
    : reason === 'bonus_ending'
    ? `Your free month of VersionVault Pro is ending in ${daysLeft} days. You're tracking ${trackedCount} app${trackedCount === 1 ? '' : 's'}, within the free plan limit of ${FREE_TIER_TRACKING_LIMIT}, so nothing will change on your account.`
    : `VersionVault's free plan allows ${FREE_TIER_TRACKING_LIMIT} tracked apps. You're currently tracking ${trackedCount}.`
  const actionTextLine = reason === 'bonus_ending'
    ? `Nothing is going to change on your account. If you'd like unlimited tracking back, you can upgrade to Pro or invite friends to earn more free Pro time.`
    : `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} before we automatically remove your oldest tracked apps beyond the free-plan limit. Renew Pro, reduce your tracked apps, or invite friends to earn free Pro time.`
  const text = `>_ VersionVault - ${label}\n\nHey ${userName},\n\n${headline}\n\n${introText}\n\n${actionTextLine}\n\nDon't want to pay? Invite a friend and you both get 1 free month of Pro.\n\nManage apps: ${VERSIONVAULT_URL}/dashboard\nInvite friends: ${VERSIONVAULT_URL}/user/referrals\nUpgrade: ${VERSIONVAULT_URL}/premium\n\n--\nVersionVault\nUnsubscribe: ${VERSIONVAULT_URL}/unsubscribe?uid=${userId}\n`

  if (!resend) {
    console.log(`📧 [dry-run] ${type} → ${email} (${trackedCount} apps, ${daysLeft} days)`)
    return
  }
  const { error } = await throttledResendSend(resend, { from: VERSIONVAULT_FROM, to: email, subject, html, text })
  if (error) console.error(`❌ grace period ${type} send failed for ${email}:`, error)
  else console.log(`✅ Sent grace period ${type} email to ${email}`)
}

async function sendGracePeriodExpiredEmail(
  resend: Resend | null,
  email: string,
  userName: string,
  userId: string,
  keptApps: string[],
  removedApps: string[],
  reason: 'subscription_ended' | 'free_overage' = 'subscription_ended'
) {
  const subject = reason === 'subscription_ended'
    ? `Your Pro has ended — we removed ${removedApps.length} tracked apps`
    : `We removed ${removedApps.length} apps from your tracking list`
  const label = reason === 'subscription_ended' ? 'PRO ENDED — APPS REMOVED' : 'GRACE PERIOD ENDED'
  const intro = reason === 'subscription_ended'
    ? `Your VersionVault Pro subscription has ended and your 30-day winddown period is up. Since you were still tracking more than <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT}</strong> apps on the free plan, we've automatically removed your oldest tracked apps beyond the limit.`
    : `Your 30-day grace period has ended. Since you were still tracking more than <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT}</strong> apps on the free plan, we've automatically removed your oldest tracked apps beyond the limit.`

  const renderList = (items: string[]) =>
    items.map(n => `<div style="font-size: 13px; color: #a3a3a3; padding: 6px 0; border-bottom: 1px solid #262626;">${n}</div>`).join('')

  const body = `
    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        ${intro}
      </div>
    </div>

    <!-- Kept apps -->
    <div style="padding: 0 24px 16px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">Still tracking</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #22c55e; padding: 3px 8px; border-radius: 4px;">${keptApps.length} KEPT</span>
        </div>
        ${renderList(keptApps)}
      </div>
    </div>

    <!-- Removed apps -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">Removed</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #ef4444; padding: 3px 8px; border-radius: 4px;">${removedApps.length} REMOVED</span>
        </div>
        ${renderList(removedApps)}
        <div style="font-size: 13px; color: #a3a3a3; margin-top: 16px; line-height: 1.6;">
          You can re-track any of these instantly by upgrading to Pro.
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 0 24px 32px 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/premium" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Upgrade to Pro — $25/yr</a>
    </div>
  `

  const html = renderShell(label, userId, body)

  const text = `Your grace period ended.\n\nStill tracking: ${keptApps.join(', ')}\nRemoved: ${removedApps.join(', ')}\n\nUpgrade: ${VERSIONVAULT_URL}/premium\n`

  if (!resend) {
    console.log(`📧 [dry-run] expired → ${email} (kept ${keptApps.length}, removed ${removedApps.length})`)
    return
  }
  const { error } = await throttledResendSend(resend, { from: VERSIONVAULT_FROM, to: email, subject, html, text })
  if (error) console.error(`❌ grace period expired send failed for ${email}:`, error)
  else console.log(`✅ Sent grace period expired email to ${email}`)
}

// Sent at expiry for users whose Pro bonus ended while already under the
// free-tier tracking limit. Nothing is removed from their account — this
// is purely a confirmation so they know the bonus month has wrapped up.
async function sendBonusEndedEmail(
  resend: Resend | null,
  email: string,
  userName: string,
  userId: string,
  trackedCount: number,
) {
  const subject = `Your free month of VersionVault Pro has ended`
  const label = 'PRO BONUS ENDED'

  const body = `
    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        Your free month of VersionVault Pro has wrapped up. You're on the free plan now, tracking <strong style="color: #ffffff;">${trackedCount}</strong> app${trackedCount === 1 ? '' : 's'} — still within the free plan limit of <strong style="color: #ffffff;">${FREE_TIER_TRACKING_LIMIT}</strong>, so nothing changed on your account.
      </div>
    </div>

    <!-- Status card -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">You're on the free plan</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #3b82f6; padding: 3px 8px; border-radius: 4px;">${label}</span>
        </div>
        <div style="font-size: 14px; font-family: monospace; margin-top: 8px;">
          <span style="color: #737373;">Tracking</span>
          <span style="color: #22c55e; font-weight: 600;"> ${trackedCount}</span>
          <span style="color: #525252;"> / </span>
          <span style="color: #22c55e; font-weight: 600;">${FREE_TIER_TRACKING_LIMIT}</span>
          <span style="color: #737373;"> allowed</span>
        </div>
        <div style="font-size: 13px; color: #a3a3a3; margin-top: 12px; line-height: 1.6;">
          Want unlimited tracking back? You can <strong style="color: #ffffff;">upgrade to Pro</strong> for $25/year, or <strong style="color: #ffffff;">invite friends</strong> to earn more free Pro time.
        </div>
      </div>
    </div>

    <!-- Referral hint card -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px 20px;">
        <div style="font-size: 13px; color: #a3a3a3; line-height: 1.6;">
          <span style="color: #ffffff; font-weight: 600;">Free Pro, the easy way:</span> invite a friend and you both get <strong style="color: #ffffff;">1 free month of Pro</strong>. Stack milestone bonuses (+2 / +3 / +6 months) at 5, 10, and 25 referrals.
        </div>
      </div>
    </div>

    <!-- CTAs -->
    <div style="padding: 0 24px 32px 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/user/referrals" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #262626; border: 1px solid #404040; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Invite friends</a>
      <a href="${VERSIONVAULT_URL}/premium" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin: 4px;">Upgrade — $25/yr</a>
    </div>
  `

  const html = renderShell(label, userId, body)

  const text = `>_ VersionVault - ${label}\n\nHey ${userName},\n\nYour free month of VersionVault Pro has wrapped up. You're on the free plan now, tracking ${trackedCount} app${trackedCount === 1 ? '' : 's'} — still within the free plan limit of ${FREE_TIER_TRACKING_LIMIT}, so nothing changed on your account.\n\nWant unlimited tracking back? Upgrade to Pro for $25/year, or invite friends to earn more free Pro time.\n\nInvite friends: ${VERSIONVAULT_URL}/user/referrals\nUpgrade: ${VERSIONVAULT_URL}/premium\n\n--\nVersionVault\nUnsubscribe: ${VERSIONVAULT_URL}/unsubscribe?uid=${userId}\n`

  if (!resend) {
    console.log(`📧 [dry-run] bonus_ended → ${email} (${trackedCount} apps)`)
    return
  }
  const { error } = await throttledResendSend(resend, { from: VERSIONVAULT_FROM, to: email, subject, html, text })
  if (error) console.error(`❌ bonus ended send failed for ${email}:`, error)
  else console.log(`✅ Sent bonus ended email to ${email}`)
}
