// Supabase Edge Function for sending user request digest
// Triggered daily at 9 AM to notify users of approved/rejected requests
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSIONVAULT_FROM = 'VersionVault <requests@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to send-user-request-digest`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const customSecretHeader = req.headers.get('X-Cron-Secret')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

      if (!authError && user) {
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
    console.log('📤 Starting user request digest...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Get approved/rejected requests from last 24 hours that haven't been notified
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    // Get software requests
    const { data: softwareRequests, error: softwareError } = await supabase
      .from('software_requests')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .or(`approved_at.gte.${yesterday.toISOString()},rejected_at.gte.${yesterday.toISOString()}`)

    // Get feature requests
    const { data: featureRequests, error: featureError } = await supabase
      .from('feature_requests')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .or(`approved_at.gte.${yesterday.toISOString()},rejected_at.gte.${yesterday.toISOString()}`)

    if (softwareError || featureError) {
      throw new Error(`Failed to fetch requests: ${softwareError?.message || featureError?.message}`)
    }

    // Filter out requests that have already been notified
    const allRequests = [...(softwareRequests || []), ...(featureRequests || [])]

    if (allRequests.length === 0) {
      console.log('✅ No new approved/rejected requests - skipping emails')
      return new Response(
        JSON.stringify({ message: 'No requests to notify', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check which requests have already been notified
    const { data: alreadyNotified } = await supabase
      .from('request_notification_log')
      .select('request_id, notification_type')
      .in('request_id', allRequests.map(r => r.id))

    const notifiedSet = new Set(
      (alreadyNotified || []).map(n => `${n.request_id}-${n.notification_type}`)
    )

    // Filter to only non-notified requests
    const softwareToNotify = (softwareRequests || []).filter(r =>
      !notifiedSet.has(`${r.id}-${r.status}`)
    )
    const featuresToNotify = (featureRequests || []).filter(r =>
      !notifiedSet.has(`${r.id}-${r.status}`)
    )

    // Group by user
    const requestsByUser = new Map<string, { software: any[], features: any[], email?: string }>()

    for (const req of softwareToNotify) {
      if (!requestsByUser.has(req.user_id)) {
        requestsByUser.set(req.user_id, { software: [], features: [] })
      }
      requestsByUser.get(req.user_id)!.software.push(req)
    }

    for (const req of featuresToNotify) {
      if (!requestsByUser.has(req.user_id)) {
        requestsByUser.set(req.user_id, { software: [], features: [] })
      }
      requestsByUser.get(req.user_id)!.features.push(req)
    }

    console.log(`📋 Found ${requestsByUser.size} user(s) with updates`)

    // Get user emails and preferences
    const userIds = Array.from(requestsByUser.keys())
    const { data: users } = await supabase.auth.admin.listUsers()

    const userEmailMap = new Map<string, string>()
    if (users?.users) {
      for (const user of users.users) {
        userEmailMap.set(user.id, user.email || '')
      }
    }

    let sentCount = 0
    const batchId = crypto.randomUUID()
    const notificationLogs: any[] = []

    // Send digest to each user
    for (const [userId, requests] of requestsByUser) {
      const userEmail = userEmailMap.get(userId)
      if (!userEmail) {
        console.log(`⚠️  No email found for user ${userId}`)
        continue
      }

      // Check email preferences
      const { data: preferences } = await supabase
        .from('user_request_email_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      const hasApproved = requests.software.some(r => r.status === 'approved') ||
                         requests.features.some(r => r.status === 'approved')
      const hasRejected = requests.software.some(r => r.status === 'rejected') ||
                         requests.features.some(r => r.status === 'rejected')

      // Skip if user has opted out of these notifications
      if (preferences) {
        if (hasApproved && !preferences.receive_approval_notifications) {
          console.log(`⏭️  User ${userEmail} opted out of approval notifications`)
          continue
        }
        if (hasRejected && !preferences.receive_rejection_notifications) {
          console.log(`⏭️  User ${userEmail} opted out of rejection notifications`)
          continue
        }
      }

      try {
        const { subject, html, text } = generateEmailContent({
          softwareRequests: requests.software,
          featureRequests: requests.features,
          userEmail,
        })

        const { error: emailError } = await resend.emails.send({
          from: VERSIONVAULT_FROM,
          to: userEmail,
          subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${VERSIONVAULT_URL}/user/notifications>`,
          },
        })

        if (emailError) {
          console.error(`❌ Failed to send to ${userEmail}:`, emailError)
        } else {
          console.log(`✅ Sent to ${userEmail}`)
          sentCount++

          // Log notifications for each request
          for (const req of [...requests.software, ...requests.features]) {
            notificationLogs.push({
              user_id: userId,
              request_type: requests.software.includes(req) ? 'software' : 'feature',
              request_id: req.id,
              notification_type: req.status,
              email_batch_id: batchId,
            })
          }
        }
      } catch (error) {
        console.error(`❌ Error sending to ${userEmail}:`, error)
      }
    }

    // Save notification logs
    if (notificationLogs.length > 0) {
      await supabase.from('request_notification_log').insert(notificationLogs)
    }

    console.log(`\n✅ User digest complete! Sent to ${sentCount} user(s)`)

    return new Response(
      JSON.stringify({
        message: 'User digest sent successfully',
        sent: sentCount,
        totalUsers: requestsByUser.size,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-user-request-digest:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate email content
function generateEmailContent(data: any): { subject: string; html: string; text: string } {
  const { softwareRequests, featureRequests, userEmail } = data

  const approvedSoftware = softwareRequests.filter((r: any) => r.status === 'approved')
  const rejectedSoftware = softwareRequests.filter((r: any) => r.status === 'rejected')
  const approvedFeatures = featureRequests.filter((r: any) => r.status === 'approved')
  const rejectedFeatures = featureRequests.filter((r: any) => r.status === 'rejected')

  const totalApproved = approvedSoftware.length + approvedFeatures.length
  const totalRejected = rejectedSoftware.length + rejectedFeatures.length

  let subject = 'Updates on your requests'
  if (totalApproved > 0 && totalRejected === 0) {
    subject = `${totalApproved} request${totalApproved === 1 ? '' : 's'} approved!`
  } else if (totalRejected > 0 && totalApproved === 0) {
    subject = `Update on your ${totalRejected} request${totalRejected === 1 ? '' : 's'}`
  }

  const userName = userEmail.split('@')[0]

  // Generate request cards
  const generateCard = (req: any, type: 'software' | 'feature', status: 'approved' | 'rejected') => {
    const isApproved = status === 'approved'
    const color = isApproved ? '#22c55e' : '#ef4444'
    const bgColor = isApproved ? '#dcfce7' : '#fee2e2'
    const darkBgColor = isApproved ? '#14532d' : '#7f1d1d'

    return `
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${type === 'software' ? req.name : req.title}</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: ${color}; padding: 3px 8px; border-radius: 4px;">${status.toUpperCase()}</span>
        </div>
        ${req.rejection_reason ? `
          <div style="background-color: ${bgColor}; padding: 12px; border-radius: 6px; margin-top: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: ${color}; margin-bottom: 4px;">Feedback:</div>
            <div style="font-size: 12px; color: #525252;">${req.rejection_reason}</div>
          </div>
        ` : ''}
        ${isApproved && type === 'software' && req.software_id ? `
          <div style="margin-top: 12px; text-align: center;">
            <a href="${VERSIONVAULT_URL}/software?highlight=${req.software_id}" style="display: inline-block; font-size: 13px; font-weight: 600; color: #ffffff; background-color: ${color}; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
              View in Library →
            </a>
          </div>
        ` : ''}
      </div>
    `
  }

  const approvedSoftwareCards = approvedSoftware.map((r: any) => generateCard(r, 'software', 'approved')).join('')
  const rejectedSoftwareCards = rejectedSoftware.map((r: any) => generateCard(r, 'software', 'rejected')).join('')
  const approvedFeatureCards = approvedFeatures.map((r: any) => generateCard(r, 'feature', 'approved')).join('')
  const rejectedFeatureCards = rejectedFeatures.map((r: any) => generateCard(r, 'feature', 'rejected')).join('')

  const html = `
<!DOCTYPE html>
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
        Request Updates
      </div>
    </div>

    <!-- Greeting -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey ${userName},</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        Here's the status of your recent requests:
      </div>
    </div>

    ${totalApproved > 0 ? `
      <!-- Approved Requests -->
      <div style="padding: 0 24px 24px 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #22c55e; margin-bottom: 12px;">✅ APPROVED</div>
        ${approvedSoftwareCards}
        ${approvedFeatureCards}
      </div>
    ` : ''}

    ${totalRejected > 0 ? `
      <!-- Rejected Requests -->
      <div style="padding: 0 24px 24px 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #ef4444; margin-bottom: 12px;">DECLINED</div>
        ${rejectedSoftwareCards}
        ${rejectedFeatureCards}
      </div>
    ` : ''}

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 13px; color: #a3a3a3; text-align: center; margin-bottom: 16px;">
        <a href="${VERSIONVAULT_URL}/requests" style="color: #a3a3a3; text-decoration: underline;">View All Requests</a>
        <span style="margin: 0 12px; color: #525252;">•</span>
        <a href="${VERSIONVAULT_URL}/user/notifications" style="color: #a3a3a3; text-decoration: underline;">Notification Settings</a>
      </div>
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `

  // Generate plain text
  let text = `>_ VersionVault - Request Updates\n\n`
  text += `Hey ${userName},\n\n`
  text += `Here's the status of your recent requests:\n\n`

  if (totalApproved > 0) {
    text += `✅ APPROVED (${totalApproved}):\n\n`
    for (const req of [...approvedSoftware, ...approvedFeatures]) {
      text += `${req.name || req.title}\n`
      if (req.software_id) {
        text += `View in library: ${VERSIONVAULT_URL}/software?highlight=${req.software_id}\n`
      }
      text += `\n`
    }
  }

  if (totalRejected > 0) {
    text += `DECLINED (${totalRejected}):\n\n`
    for (const req of [...rejectedSoftware, ...rejectedFeatures]) {
      text += `${req.name || req.title}\n`
      if (req.rejection_reason) {
        text += `Feedback: ${req.rejection_reason}\n`
      }
      text += `\n`
    }
  }

  text += `View All Requests: ${VERSIONVAULT_URL}/requests\n`
  text += `Notification Settings: ${VERSIONVAULT_URL}/user/notifications\n\n`
  text += `© ${new Date().getFullYear()} VersionVault`

  return { subject, html, text }
}
