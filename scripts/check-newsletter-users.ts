// Script to check all users and their newsletter digest settings
// Run with: deno run --allow-net --allow-env scripts/check-newsletter-users.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required')
  console.error('Set them with:')
  console.error('  export SUPABASE_URL=your_url')
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=your_key')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface UserStatus {
  email: string
  status: string
  notification_frequency: string | null
  email_notifications: boolean | null
  tracked_software_count: number
  recent_hard_bounces: number
  timezone: string | null
  user_created_at: string
  settings_created_at: string | null
}

async function checkNewsletterUsers() {
  console.log('📊 Fetching all users and their newsletter settings...\n')

  // Get all users from auth
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Error fetching users:', authError.message)
    return
  }

  console.log(`Found ${authUsers.users.length} total users\n`)

  // Get all user settings
  const { data: userSettings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')

  if (settingsError) {
    console.error('❌ Error fetching user settings:', settingsError.message)
    return
  }

  // Create a map of user_id -> settings
  const settingsMap = new Map(
    (userSettings || []).map(s => [s.user_id, s])
  )

  // Get tracked software counts for all users
  const { data: trackedSoftware, error: trackedError } = await supabase
    .from('tracked_software')
    .select('user_id')

  if (trackedError) {
    console.error('❌ Error fetching tracked software:', trackedError.message)
    return
  }

  // Count tracked software per user
  const trackedCounts = new Map<string, number>()
  for (const tracked of trackedSoftware || []) {
    trackedCounts.set(tracked.user_id, (trackedCounts.get(tracked.user_id) || 0) + 1)
  }

  // Get bounce counts
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: bounces, error: bounceError } = await supabase
    .from('email_bounces')
    .select('user_id, bounce_type')
    .eq('bounce_type', 'hard')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (bounceError) {
    console.error('⚠️  Warning: Could not fetch bounce data:', bounceError.message)
  }

  // Count hard bounces per user
  const bounceCounts = new Map<string, number>()
  for (const bounce of bounces || []) {
    bounceCounts.set(bounce.user_id, (bounceCounts.get(bounce.user_id) || 0) + 1)
  }

  // Analyze each user
  const userStatuses: UserStatus[] = []
  const notGettingDigest: UserStatus[] = []
  const specificEmails = ['andy@andyegan.co', 'theandyegan@gmail.com']

  for (const user of authUsers.users) {
    if (!user.email) continue

    const settings = settingsMap.get(user.id)
    const trackedCount = trackedCounts.get(user.id) || 0
    const bounceCount = bounceCounts.get(user.id) || 0

    let status = ''
    let notGetting = false

    if (!settings) {
      status = '❌ NO SETTINGS RECORD'
      notGetting = true
    } else if (settings.email_notifications === false) {
      status = '🔕 NOTIFICATIONS DISABLED'
      notGetting = true
    } else if (settings.notification_frequency === 'monthly') {
      status = '📅 MONTHLY DIGEST (not checked)'
    } else if (trackedCount === 0) {
      status = '⏭️  NO TRACKED SOFTWARE'
      notGetting = true
    } else if (bounceCount >= 3) {
      status = '⚠️  TOO MANY BOUNCES'
      notGetting = true
    } else if (settings.notification_frequency === 'daily') {
      status = '✅ DAILY DIGEST'
    } else if (settings.notification_frequency === 'weekly') {
      status = '✅ WEEKLY DIGEST'
    } else {
      status = '⚠️  UNKNOWN STATUS'
      notGetting = true
    }

    const userStatus: UserStatus = {
      email: user.email,
      status,
      notification_frequency: settings?.notification_frequency || null,
      email_notifications: settings?.email_notifications ?? null,
      tracked_software_count: trackedCount,
      recent_hard_bounces: bounceCount,
      timezone: settings?.timezone || null,
      user_created_at: user.created_at,
      settings_created_at: settings?.created_at || null,
    }

    userStatuses.push(userStatus)

    if (notGetting && settings?.notification_frequency !== 'monthly') {
      notGettingDigest.push(userStatus)
    }
  }

  // Display results
  console.log('=' .repeat(120))
  console.log('ALL USERS NOT GETTING NEWSLETTER DIGEST (excluding monthly):')
  console.log('=' .repeat(120))
  console.log('')

  if (notGettingDigest.length === 0) {
    console.log('✅ All users are set up correctly!')
  } else {
    for (const user of notGettingDigest) {
      console.log(`📧 ${user.email}`)
      console.log(`   Status: ${user.status}`)
      console.log(`   Email Notifications: ${user.email_notifications ?? 'NOT SET'}`)
      console.log(`   Frequency: ${user.notification_frequency || 'NOT SET'}`)
      console.log(`   Tracked Software: ${user.tracked_software_count}`)
      console.log(`   Recent Bounces: ${user.recent_hard_bounces}`)
      console.log(`   Timezone: ${user.timezone || 'NOT SET'}`)
      console.log('')
    }
  }

  console.log('=' .repeat(120))
  console.log('SPECIFIC USERS MENTIONED:')
  console.log('=' .repeat(120))
  console.log('')

  const foundSpecific = userStatuses.filter(u =>
    specificEmails.some(email => u.email.toLowerCase() === email.toLowerCase())
  )

  if (foundSpecific.length === 0) {
    console.log('❌ None of the specified emails found in the database:')
    for (const email of specificEmails) {
      console.log(`   - ${email}`)
    }
  } else {
    for (const user of foundSpecific) {
      console.log(`📧 ${user.email}`)
      console.log(`   Status: ${user.status}`)
      console.log(`   Email Notifications: ${user.email_notifications ?? 'NOT SET'}`)
      console.log(`   Frequency: ${user.notification_frequency || 'NOT SET'}`)
      console.log(`   Tracked Software: ${user.tracked_software_count}`)
      console.log(`   Recent Bounces: ${user.recent_hard_bounces}`)
      console.log(`   Timezone: ${user.timezone || 'NOT SET'}`)
      console.log('')
    }
  }

  // Summary
  console.log('=' .repeat(120))
  console.log('📊 SUMMARY:')
  console.log('=' .repeat(120))
  console.log('')

  const summary = {
    total: userStatuses.length,
    noSettings: userStatuses.filter(u => u.email_notifications === null).length,
    disabled: userStatuses.filter(u => u.email_notifications === false).length,
    daily: userStatuses.filter(u => u.notification_frequency === 'daily' && u.email_notifications === true).length,
    weekly: userStatuses.filter(u => u.notification_frequency === 'weekly' && u.email_notifications === true).length,
    monthly: userStatuses.filter(u => u.notification_frequency === 'monthly' && u.email_notifications === true).length,
    noTracked: userStatuses.filter(u => u.email_notifications === true && u.tracked_software_count === 0).length,
    tooManyBounces: userStatuses.filter(u => u.recent_hard_bounces >= 3).length,
  }

  console.log(`Total Users: ${summary.total}`)
  console.log(``)
  console.log(`❌ No Settings Record: ${summary.noSettings}`)
  console.log(`🔕 Notifications Disabled: ${summary.disabled}`)
  console.log(`⏭️  No Tracked Software: ${summary.noTracked}`)
  console.log(`⚠️  Too Many Bounces: ${summary.tooManyBounces}`)
  console.log(``)
  console.log(`✅ Daily Digest: ${summary.daily}`)
  console.log(`✅ Weekly Digest: ${summary.weekly}`)
  console.log(`📅 Monthly Digest: ${summary.monthly}`)
  console.log('')

  // Not getting digest count (excluding monthly)
  const notGettingCount = summary.noSettings + summary.disabled + summary.noTracked + summary.tooManyBounces
  console.log(`🚫 Users NOT getting digest (excluding monthly): ${notGettingCount}`)
  console.log('')
}

// Run the check
checkNewsletterUsers().catch(console.error)
