// Supabase Edge Function for sending admin request digest
// Triggered daily at 9 AM to notify admins of NEW pending requests
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
  console.log(`📥 Received ${req.method} request to send-admin-request-digest`)

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
    console.log('📤 Starting admin request digest...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Get NEW pending requests from last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: softwareRequests, error: softwareError } = await supabase
      .from('software_requests_with_user')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })

    const { data: featureRequests, error: featureError } = await supabase
      .from('feature_requests_with_user')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false })

    if (softwareError || featureError) {
      throw new Error(`Failed to fetch requests: ${softwareError?.message || featureError?.message}`)
    }

    const totalRequests = (softwareRequests?.length || 0) + (featureRequests?.length || 0)

    console.log(`📋 Found ${totalRequests} new pending requests`)
    console.log(`   - ${softwareRequests?.length || 0} software requests`)
    console.log(`   - ${featureRequests?.length || 0} feature requests`)

    // If no new requests, don't send email
    if (totalRequests === 0) {
      console.log('✅ No new requests - skipping email')
      return new Response(
        JSON.stringify({ message: 'No new requests to notify', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all admins
    const { data: admins, error: adminsError } = await supabase
      .from('admin_users')
      .select(`
        user_id,
        users:user_id (
          email
        )
      `)

    if (adminsError || !admins || admins.length === 0) {
      console.error('❌ Failed to fetch admins:', adminsError)
      return new Response(
        JSON.stringify({ error: 'No admins found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📧 Sending to ${admins.length} admin(s)`)

    // Generate email content
    const { subject, html, text } = generateEmailContent({
      softwareRequests: softwareRequests || [],
      featureRequests: featureRequests || [],
    })

    let sentCount = 0
    const adminIds: string[] = []
    const requestIds: string[] = [
      ...(softwareRequests || []).map(r => r.id),
      ...(featureRequests || []).map(r => r.id),
    ]

    // Send to each admin
    for (const admin of admins) {
      const userEmail = (admin.users as any)?.email
      if (!userEmail) continue

      try {
        const { error: emailError } = await resend.emails.send({
          from: VERSIONVAULT_FROM,
          to: userEmail,
          subject,
          html,
          text,
        })

        if (emailError) {
          console.error(`❌ Failed to send to ${userEmail}:`, emailError)
        } else {
          console.log(`✅ Sent to ${userEmail}`)
          sentCount++
          adminIds.push(admin.user_id)
        }
      } catch (error) {
        console.error(`❌ Error sending to ${userEmail}:`, error)
      }
    }

    // Log the digest
    await supabase.from('admin_request_digest_log').insert({
      software_request_count: softwareRequests?.length || 0,
      feature_request_count: featureRequests?.length || 0,
      request_ids: requestIds,
      recipient_admin_ids: adminIds,
    })

    console.log(`\n✅ Admin digest complete! Sent to ${sentCount} admin(s)`)

    return new Response(
      JSON.stringify({
        message: 'Admin digest sent successfully',
        sent: sentCount,
        totalRequests,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-admin-request-digest:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate email content
function generateEmailContent(data: any): { subject: string; html: string; text: string } {
  const { softwareRequests, featureRequests } = data
  const totalCount = softwareRequests.length + featureRequests.length

  const subject = `${totalCount} new request${totalCount === 1 ? '' : 's'} pending review`

  // Generate software request cards
  const softwareCards = softwareRequests.map((req: any) => `
    <a href="${VERSIONVAULT_URL}/requests" style="text-decoration: none; display: block; color: inherit;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${req.name}</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #f59e0b; padding: 3px 8px; border-radius: 4px;">SOFTWARE</span>
        </div>
        <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 8px;">
          Requested by ${req.user_name || 'Unknown'} (${req.user_email || 'unknown'})
        </div>
        <div style="font-size: 12px; color: #737373; margin-bottom: 4px;">
          <strong>Website:</strong> ${req.website}
        </div>
        ${req.description ? `
          <div style="font-size: 12px; color: #a3a3a3; margin-top: 8px; padding-top: 8px; border-top: 1px solid #262626;">
            ${req.description}
          </div>
        ` : ''}
        <div style="font-size: 11px; color: #525252; margin-top: 8px;">
          Submitted ${formatDate(req.created_at)}
        </div>
      </div>
    </a>
  `).join('')

  // Generate feature request cards
  const featureCards = featureRequests.map((req: any) => `
    <a href="${VERSIONVAULT_URL}/requests" style="text-decoration: none; display: block; color: inherit;">
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${req.title}</span>
          <span style="font-size: 10px; font-weight: 600; color: #ffffff; background-color: #8b5cf6; padding: 3px 8px; border-radius: 4px;">FEATURE</span>
        </div>
        <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 8px;">
          Requested by ${req.user_name || 'Unknown'} (${req.user_email || 'unknown'})
        </div>
        ${req.category ? `
          <div style="font-size: 12px; color: #737373; margin-bottom: 4px;">
            <strong>Category:</strong> ${req.category}
          </div>
        ` : ''}
        <div style="font-size: 12px; color: #a3a3a3; margin-top: 8px; padding-top: 8px; border-top: 1px solid #262626;">
          ${req.description}
        </div>
        <div style="font-size: 11px; color: #525252; margin-top: 8px;">
          Submitted ${formatDate(req.created_at)}
        </div>
      </div>
    </a>
  `).join('')

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
        Admin Request Digest
      </div>
    </div>

    <!-- Summary -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey Admin,</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        You have <strong>${totalCount}</strong> new pending request${totalCount === 1 ? '' : 's'} from the last 24 hours:
      </div>
      ${softwareRequests.length > 0 ? `
        <div style="font-size: 13px; color: #f59e0b; margin-top: 8px;">
          • ${softwareRequests.length} software request${softwareRequests.length === 1 ? '' : 's'}
        </div>
      ` : ''}
      ${featureRequests.length > 0 ? `
        <div style="font-size: 13px; color: #8b5cf6; margin-top: 4px;">
          • ${featureRequests.length} feature request${featureRequests.length === 1 ? '' : 's'}
        </div>
      ` : ''}
    </div>

    ${softwareRequests.length > 0 ? `
      <!-- Software Requests -->
      <div style="padding: 0 24px 24px 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 12px;">SOFTWARE REQUESTS</div>
        ${softwareCards}
      </div>
    ` : ''}

    ${featureRequests.length > 0 ? `
      <!-- Feature Requests -->
      <div style="padding: 0 24px 24px 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #8b5cf6; margin-bottom: 12px;">FEATURE REQUESTS</div>
        ${featureCards}
      </div>
    ` : ''}

    <!-- CTA -->
    <div style="padding: 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/requests" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Review Requests →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Software Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `

  // Generate plain text version
  let text = `>_ VersionVault - Admin Request Digest\n\n`
  text += `Hey Admin,\n\n`
  text += `You have ${totalCount} new pending request${totalCount === 1 ? '' : 's'} from the last 24 hours:\n\n`

  if (softwareRequests.length > 0) {
    text += `SOFTWARE REQUESTS (${softwareRequests.length}):\n\n`
    for (const req of softwareRequests) {
      text += `${req.name}\n`
      text += `Requested by ${req.user_name || 'Unknown'} (${req.user_email || 'unknown'})\n`
      text += `Website: ${req.website}\n`
      if (req.description) text += `${req.description}\n`
      text += `Submitted ${formatDate(req.created_at)}\n\n`
    }
  }

  if (featureRequests.length > 0) {
    text += `FEATURE REQUESTS (${featureRequests.length}):\n\n`
    for (const req of featureRequests) {
      text += `${req.title}\n`
      text += `Requested by ${req.user_name || 'Unknown'} (${req.user_email || 'unknown'})\n`
      if (req.category) text += `Category: ${req.category}\n`
      text += `${req.description}\n`
      text += `Submitted ${formatDate(req.created_at)}\n\n`
    }
  }

  text += `Review Requests: ${VERSIONVAULT_URL}/requests\n\n`
  text += `© ${new Date().getFullYear()} VersionVault`

  return { subject, html, text }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}
