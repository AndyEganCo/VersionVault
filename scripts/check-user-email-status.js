#!/usr/bin/env node

/**
 * Script to check email digest status for specific users
 * Queries the Supabase database to diagnose why users aren't receiving emails
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const TARGET_EMAILS = ['andy@andyegan.co', 'theandyegan@gmail.com']

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔍 Checking email digest status for:')
  TARGET_EMAILS.forEach(email => console.log(`   - ${email}`))
  console.log('')

  // 1. Check if users exist
  console.log('═══════════════════════════════════════════════════════')
  console.log('1. CHECKING AUTH.USERS')
  console.log('═══════════════════════════════════════════════════════')

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Error fetching users:', authError.message)
    return
  }

  const targetUsers = authUsers.users.filter(u => TARGET_EMAILS.includes(u.email))

  if (targetUsers.length === 0) {
    console.log('❌ No users found with those emails!')
    return
  }

  for (const user of targetUsers) {
    console.log(`\n✅ Found: ${user.email}`)
    console.log(`   User ID: ${user.id}`)
    console.log(`   Created: ${user.created_at}`)
    console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`)
    console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
  }

  // 2. Check user_settings
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('2. CHECKING USER_SETTINGS')
  console.log('═══════════════════════════════════════════════════════')

  for (const user of targetUsers) {
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log(`\n📧 ${user.email}:`)

    if (settingsError || !settings) {
      console.log('   ❌ NO USER_SETTINGS ROW FOUND!')
      console.log('   This is likely the issue - user will be excluded from digest query')
      continue
    }

    console.log(`   Email Notifications: ${settings.email_notifications ? '✅ ENABLED' : '❌ DISABLED'}`)
    console.log(`   Frequency: ${settings.notification_frequency}`)
    console.log(`   Timezone: ${settings.timezone}`)
    console.log(`   App Update Notifications: ${settings.app_update_notifications}`)
    console.log(`   Last Updated: ${settings.updated_at}`)

    if (!settings.email_notifications) {
      console.log('   ⚠️  EMAIL NOTIFICATIONS ARE DISABLED - This is why they\'re not getting emails!')
    }
  }

  // 3. Check tracked software
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('3. CHECKING TRACKED SOFTWARE')
  console.log('═══════════════════════════════════════════════════════')

  for (const user of targetUsers) {
    const { data: tracked, error: trackedError } = await supabase
      .from('tracked_software')
      .select('software_id, last_notified_version')
      .eq('user_id', user.id)

    console.log(`\n📦 ${user.email}:`)

    if (trackedError) {
      console.log(`   ❌ Error: ${trackedError.message}`)
      continue
    }

    if (!tracked || tracked.length === 0) {
      console.log('   ❌ NO TRACKED SOFTWARE!')
      console.log('   Users with no tracked software are skipped in queue-weekly-digest')
      continue
    }

    console.log(`   ✅ Tracking ${tracked.length} software package(s)`)

    // Get software details
    const softwareIds = tracked.map(t => t.software_id)
    const { data: softwareDetails } = await supabase
      .from('software')
      .select('id, name, manufacturer')
      .in('id', softwareIds)

    if (softwareDetails) {
      softwareDetails.forEach(sw => {
        console.log(`      - ${sw.name} (${sw.manufacturer})`)
      })
    }
  }

  // 4. Check email bounces
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('4. CHECKING EMAIL BOUNCES (last 30 days)')
  console.log('═══════════════════════════════════════════════════════')

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  for (const user of targetUsers) {
    const { data: bounces, error: bounceError } = await supabase
      .from('email_bounces')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })

    console.log(`\n📬 ${user.email}:`)

    if (bounceError) {
      console.log(`   ❌ Error: ${bounceError.message}`)
      continue
    }

    if (!bounces || bounces.length === 0) {
      console.log('   ✅ No bounces in last 30 days')
      continue
    }

    const hardBounces = bounces.filter(b => b.bounce_type === 'hard')
    const softBounces = bounces.filter(b => b.bounce_type === 'soft')

    console.log(`   ⚠️  Total Bounces: ${bounces.length}`)
    console.log(`   Hard Bounces: ${hardBounces.length}`)
    console.log(`   Soft Bounces: ${softBounces.length}`)

    if (hardBounces.length >= 3) {
      console.log('   ❌ TOO MANY HARD BOUNCES! (>= 3)')
      console.log('   This user will be skipped in queue-weekly-digest')
    }

    // Show most recent bounces
    console.log('\n   Recent bounces:')
    bounces.slice(0, 3).forEach(b => {
      console.log(`      - ${b.bounce_type} on ${b.created_at}`)
      if (b.reason) console.log(`        Reason: ${b.reason}`)
    })
  }

  // 5. Check newsletter queue
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('5. CHECKING NEWSLETTER QUEUE (last 14 days)')
  console.log('═══════════════════════════════════════════════════════')

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  for (const user of targetUsers) {
    const { data: queue, error: queueError } = await supabase
      .from('newsletter_queue')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false })

    console.log(`\n📮 ${user.email}:`)

    if (queueError) {
      console.log(`   ❌ Error: ${queueError.message}`)
      continue
    }

    if (!queue || queue.length === 0) {
      console.log('   ⚠️  NO QUEUE ENTRIES IN LAST 14 DAYS')
      console.log('   This means queue-weekly-digest is not creating entries for this user')
      continue
    }

    console.log(`   Found ${queue.length} queue entries:`)
    queue.forEach(q => {
      console.log(`\n      Email Type: ${q.email_type}`)
      console.log(`      Status: ${q.status}`)
      console.log(`      Scheduled For: ${q.scheduled_for}`)
      console.log(`      Created: ${q.created_at}`)
      console.log(`      Sent: ${q.sent_at || 'Not sent'}`)
      console.log(`      Attempts: ${q.attempts}/${q.max_attempts}`)
      if (q.last_error) {
        console.log(`      ❌ Error: ${q.last_error}`)
      }
    })
  }

  // 6. Check newsletter logs
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('6. CHECKING NEWSLETTER LOGS (last 30 days)')
  console.log('═══════════════════════════════════════════════════════')

  for (const user of targetUsers) {
    const { data: logs, error: logsError } = await supabase
      .from('newsletter_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })

    console.log(`\n📊 ${user.email}:`)

    if (logsError) {
      console.log(`   ❌ Error: ${logsError.message}`)
      continue
    }

    if (!logs || logs.length === 0) {
      console.log('   ⚠️  NO EMAILS SENT IN LAST 30 DAYS')
      continue
    }

    console.log(`   Sent ${logs.length} emails in last 30 days:`)
    logs.slice(0, 5).forEach(log => {
      console.log(`\n      Type: ${log.email_type}`)
      console.log(`      Status: ${log.status}`)
      console.log(`      Sent: ${log.created_at}`)
      if (log.opened_at) console.log(`      Opened: ${log.opened_at}`)
      if (log.clicked_at) console.log(`      Clicked: ${log.clicked_at}`)
    })
  }

  // 7. Summary
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('7. DIAGNOSIS SUMMARY')
  console.log('═══════════════════════════════════════════════════════')

  for (const user of targetUsers) {
    console.log(`\n🔍 ${user.email}:`)

    // Check settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!settings) {
      console.log('   🔴 ISSUE: Missing user_settings row')
      console.log('   📋 ACTION: Run the following SQL:')
      console.log(`   INSERT INTO user_settings (user_id, email_notifications, notification_frequency, timezone)`)
      console.log(`   VALUES ('${user.id}', true, 'weekly', 'America/New_York');`)
      continue
    }

    if (!settings.email_notifications) {
      console.log('   🔴 ISSUE: Email notifications disabled')
      console.log('   📋 ACTION: Enable via UI or run:')
      console.log(`   UPDATE user_settings SET email_notifications = true WHERE user_id = '${user.id}';`)
      continue
    }

    // Check tracked software
    const { data: tracked } = await supabase
      .from('tracked_software')
      .select('software_id')
      .eq('user_id', user.id)

    if (!tracked || tracked.length === 0) {
      console.log('   🔴 ISSUE: No tracked software')
      console.log('   📋 ACTION: User needs to add software to track')
      continue
    }

    // Check bounces
    const { data: bounces } = await supabase
      .from('email_bounces')
      .select('*')
      .eq('user_id', user.id)
      .eq('bounce_type', 'hard')
      .gte('created_at', thirtyDaysAgo)

    if (bounces && bounces.length >= 3) {
      console.log('   🔴 ISSUE: Too many hard bounces (>= 3)')
      console.log('   📋 ACTION: Check email validity, clear bounces if email is fixed')
      continue
    }

    // Check queue
    const { data: queue } = await supabase
      .from('newsletter_queue')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', fourteenDaysAgo)

    if (!queue || queue.length === 0) {
      console.log('   🔴 ISSUE: Not being queued by queue-weekly-digest edge function')
      console.log('   📋 ACTION: Check edge function cron job is running')
      console.log(`   Frequency setting: ${settings.notification_frequency}`)
      console.log('   Verify cron job runs for this frequency')
      continue
    }

    console.log('   ✅ Everything looks configured correctly')
    console.log('   📋 Check edge function logs for processing issues')
  }

  console.log('\n✅ Diagnosis complete!\n')
}

main().catch(console.error)
