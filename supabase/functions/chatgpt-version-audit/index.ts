// Supabase Edge Function for ChatGPT-powered version audit
// Triggered every 3 days to check if any software versions are outdated
// Acts as a safety net to catch versions missed by regular scraping
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERSIONVAULT_FROM = 'VersionVault <audit@updates.versionvault.dev>'
const VERSIONVAULT_URL = 'https://versionvault.dev'

interface SoftwareItem {
  id: string
  name: string
  current_version: string | null
}

interface AuditFlag {
  software_id: string
  software_name: string
  current_version: string
  suggested_version: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

interface ChatGPTResponse {
  outdated: AuditFlag[]
  summary: string
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to chatgpt-version-audit`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const customSecretHeader = req.headers.get('X-Cron-Secret')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!openaiApiKey) {
      console.error('❌ Missing OPENAI_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: OPENAI_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!resendApiKey) {
      console.error('❌ Missing RESEND_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: RESEND_API_KEY not set' }),
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
    console.log('🔍 Starting ChatGPT version audit...')

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Fetch all software with current versions
    const { data: software, error: softwareError } = await supabase
      .from('software')
      .select('id, name, current_version')
      .order('name')

    if (softwareError) {
      throw new Error(`Failed to fetch software: ${softwareError.message}`)
    }

    if (!software || software.length === 0) {
      console.log('⚠️ No software found to audit')
      return new Response(
        JSON.stringify({ message: 'No software to audit', flagged: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Auditing ${software.length} software items...`)

    // Prepare data for ChatGPT
    const softwareList = software
      .map((s: SoftwareItem) => `- ${s.name}: ${s.current_version || 'No version tracked'}`)
      .join('\n')

    // Call ChatGPT API with latest model
    // Using GPT-5 for most up-to-date knowledge (2025+ cutoff)
    const chatGPTModel = 'gpt-5'
    console.log(`🤖 Calling ChatGPT (${chatGPTModel})...`)

    // Build API request based on model type
    // o1 models: single user message, no system/temperature/response_format
    // gpt-5 models: system messages supported, but temperature must be default (1)
    // Standard models (gpt-4o, gpt-4.5): full parameter support
    const isO1Model = chatGPTModel.startsWith('o1')
    const isGPT5Model = chatGPTModel.startsWith('gpt-5')

    const systemPrompt = `You are a software version tracking assistant. Your job is to identify if any software versions are outdated based on your knowledge.

CRITICAL: Only flag software if you are reasonably confident. Do not guess or hallucinate versions. If a version is already current or very recent, DO NOT flag it.

For each outdated software, provide:
1. The software name (must match exactly from the input)
2. The latest version you know about
3. Confidence level (high/medium/low) based on:
   - high: Recent knowledge (within 6 months), certain this version exists
   - medium: Somewhat recent knowledge, likely accurate
   - low: Older knowledge, may need verification
4. Brief reasoning (one sentence)

Respond ONLY with valid JSON in this exact format:
{
  "outdated": [
    {
      "software_name": "exact name from input",
      "current_version": "version from input",
      "suggested_version": "latest version you know",
      "confidence": "high|medium|low",
      "reasoning": "brief explanation"
    }
  ],
  "summary": "brief summary of findings"
}

If no software is outdated, return: {"outdated": [], "summary": "All software appears up to date based on available knowledge."}`

    const userPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}.

Check if any of these software versions are outdated:

${softwareList}`

    const requestBody: any = {
      model: chatGPTModel,
      messages: isO1Model
        ? [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }]
        : [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
    }

    // Add parameters based on model capabilities
    if (!isO1Model && !isGPT5Model) {
      // Only older models (gpt-4o, gpt-4-turbo) support custom temperature
      requestBody.temperature = 0.1
    }

    if (!isO1Model) {
      // Both GPT-5 and older models support JSON mode
      requestBody.response_format = { type: 'json_object' }
    }

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      throw new Error(`ChatGPT API error: ${chatResponse.status} ${errorText}`)
    }

    const chatData = await chatResponse.json()
    const content = chatData.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from ChatGPT')
    }

    console.log('📦 ChatGPT response received')

    // Parse response
    let parsedResponse: ChatGPTResponse
    try {
      parsedResponse = JSON.parse(content)
    } catch (e) {
      console.error('Failed to parse ChatGPT response:', content)
      throw new Error(`Invalid JSON from ChatGPT: ${e.message}`)
    }

    console.log(`🎯 ChatGPT found ${parsedResponse.outdated.length} potentially outdated software`)
    console.log(`📝 Summary: ${parsedResponse.summary}`)

    // Create audit run record
    const auditRunId = crypto.randomUUID()
    const executionTime = Date.now() - startTime

    const { error: runInsertError } = await supabase
      .from('version_audit_runs')
      .insert({
        id: auditRunId,
        total_software_checked: software.length,
        flags_created: parsedResponse.outdated.length,
        chatgpt_model: chatGPTModel,
        execution_time_ms: executionTime,
      })

    if (runInsertError) {
      console.error('⚠️ Failed to insert audit run:', runInsertError)
    }

    // If no outdated software found, we're done
    if (parsedResponse.outdated.length === 0) {
      console.log('✅ No outdated software detected - audit complete!')

      await supabase
        .from('version_audit_runs')
        .update({ admin_notified: true, notification_sent_at: new Date().toISOString() })
        .eq('id', auditRunId)

      return new Response(
        JSON.stringify({
          message: 'Audit complete - no outdated software found',
          audited: software.length,
          flagged: 0,
          summary: parsedResponse.summary
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create flags for outdated software
    const flags: any[] = []
    const flaggedSoftware: { name: string, current: string, suggested: string, confidence: string }[] = []

    for (const item of parsedResponse.outdated) {
      // Find matching software by name
      const matchedSoftware = software.find(
        (s: SoftwareItem) => s.name.toLowerCase() === item.software_name.toLowerCase()
      )

      if (!matchedSoftware) {
        console.warn(`⚠️ Could not find software: ${item.software_name}`)
        continue
      }

      flags.push({
        software_id: matchedSoftware.id,
        audit_run_id: auditRunId,
        current_version: item.current_version,
        suggested_version: item.suggested_version,
        confidence: item.confidence,
        chatgpt_reasoning: item.reasoning,
        verification_result: 'pending',
      })

      flaggedSoftware.push({
        name: matchedSoftware.name,
        current: item.current_version,
        suggested: item.suggested_version,
        confidence: item.confidence,
      })

      console.log(`  🚩 ${matchedSoftware.name}: ${item.current_version} → ${item.suggested_version} (${item.confidence} confidence)`)
    }

    // Insert flags
    if (flags.length > 0) {
      const { error: flagsError } = await supabase
        .from('version_audit_flags')
        .insert(flags)

      if (flagsError) {
        console.error('❌ Failed to insert flags:', flagsError)
        throw new Error(`Failed to insert audit flags: ${flagsError.message}`)
      }

      console.log(`✅ Created ${flags.length} audit flags`)
    }

    // Send admin notification email
    console.log('📧 Sending admin notification...')

    // Get all admins
    console.log('📧 Fetching admin users for notification...')
    const { data: admins, error: adminsError } = await supabase
      .from('admin_users')
      .select(`
        user_id,
        users:user_id (
          email
        )
      `)

    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError)
    } else if (!admins || admins.length === 0) {
      console.warn('⚠️ No admins found in admin_users table - skipping email notification')
    } else {
      console.log(`📧 Found ${admins.length} admin(s) to notify`)
      const { subject, html, text } = generateEmailContent({
        flaggedSoftware,
        totalAudited: software.length,
        summary: parsedResponse.summary,
      })

      let sentCount = 0

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
            console.log(`✅ Sent notification to ${userEmail}`)
            sentCount++
          }
        } catch (error) {
          console.error(`❌ Error sending to ${userEmail}:`, error)
        }
      }

      // Update audit run with notification status
      await supabase
        .from('version_audit_runs')
        .update({
          admin_notified: sentCount > 0,
          notification_sent_at: sentCount > 0 ? new Date().toISOString() : null
        })
        .eq('id', auditRunId)

      console.log(`📧 Sent notifications to ${sentCount} admin(s)`)
    }

    console.log(`\n✅ Version audit complete!`)
    console.log(`   Audited: ${software.length} software items`)
    console.log(`   Flagged: ${flags.length} potentially outdated`)
    console.log(`   Execution time: ${executionTime}ms`)

    return new Response(
      JSON.stringify({
        message: 'Version audit complete',
        audited: software.length,
        flagged: flags.length,
        summary: parsedResponse.summary,
        execution_time_ms: executionTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in chatgpt-version-audit:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate email content
function generateEmailContent(data: {
  flaggedSoftware: { name: string, current: string, suggested: string, confidence: string }[]
  totalAudited: number
  summary: string
}): { subject: string; html: string; text: string } {
  const { flaggedSoftware, totalAudited, summary } = data
  const flagCount = flaggedSoftware.length

  const subject = `Version Audit: ${flagCount} potentially outdated software detected`

  // Generate software cards
  const softwareCards = flaggedSoftware.map((item) => {
    const confidenceColor = item.confidence === 'high' ? '#22c55e' : item.confidence === 'medium' ? '#f59e0b' : '#ef4444'
    const confidenceBadge = item.confidence.toUpperCase()

    return `
    <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 16px; font-weight: 600; color: #ffffff;">${item.name}</span>
        <span style="font-size: 10px; font-weight: 600; color: #000000; background-color: ${confidenceColor}; padding: 3px 8px; border-radius: 4px;">${confidenceBadge}</span>
      </div>
      <div style="font-size: 13px; color: #a3a3a3; margin-bottom: 4px;">
        <strong>Current:</strong> ${item.current}
      </div>
      <div style="font-size: 13px; color: #22c55e; margin-bottom: 4px;">
        <strong>Suggested:</strong> ${item.suggested}
      </div>
    </div>
    `
  }).join('')

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
        ChatGPT Version Audit Results
      </div>
    </div>

    <!-- Summary -->
    <div style="padding: 24px;">
      <div style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Hey Admin,</div>
      <div style="font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        ChatGPT just completed a version audit of all <strong>${totalAudited}</strong> software items and flagged <strong style="color: #f59e0b;">${flagCount}</strong> as potentially outdated.
      </div>
      <div style="background-color: #171717; border-left: 3px solid #3b82f6; padding: 12px; margin-top: 16px; border-radius: 4px;">
        <div style="font-size: 12px; color: #737373; margin-bottom: 4px;">AI SUMMARY</div>
        <div style="font-size: 13px; color: #d4d4d4; line-height: 1.5;">${summary}</div>
      </div>
    </div>

    <!-- Flagged Software -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 12px;">FLAGGED SOFTWARE</div>
      ${softwareCards}
    </div>

    <!-- Important Notice -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background-color: #171717; border: 1px solid #404040; border-radius: 8px; padding: 16px;">
        <div style="font-size: 12px; font-weight: 600; color: #f59e0b; margin-bottom: 8px;">⚠️ VERIFICATION NEEDED</div>
        <div style="font-size: 12px; color: #a3a3a3; line-height: 1.5;">
          These are AI-suggested versions. Our regular scraper will automatically verify and extract full details for flagged items. You can also manually trigger a version check if needed.
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 24px; text-align: center;">
      <a href="${VERSIONVAULT_URL}/admin" style="display: inline-block; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #2563eb; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        View Admin Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 24px; border-top: 1px solid #262626;">
      <div style="font-size: 12px; color: #525252; text-align: center; margin-bottom: 8px;">VersionVault • Automated Version Tracking</div>
      <div style="font-size: 12px; color: #404040; text-align: center;">© ${new Date().getFullYear()} VersionVault. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `

  // Generate plain text version
  let text = `>_ VersionVault - Version Audit Results\n\n`
  text += `Hey Admin,\n\n`
  text += `ChatGPT just completed a version audit of all ${totalAudited} software items and flagged ${flagCount} as potentially outdated.\n\n`
  text += `AI SUMMARY:\n${summary}\n\n`
  text += `FLAGGED SOFTWARE:\n\n`

  for (const item of flaggedSoftware) {
    text += `${item.name} [${item.confidence.toUpperCase()} CONFIDENCE]\n`
    text += `  Current: ${item.current}\n`
    text += `  Suggested: ${item.suggested}\n\n`
  }

  text += `⚠️ VERIFICATION NEEDED\n`
  text += `These are AI-suggested versions. Our regular scraper will automatically verify and extract full details for flagged items.\n\n`
  text += `View Admin Dashboard: ${VERSIONVAULT_URL}/admin\n\n`
  text += `© ${new Date().getFullYear()} VersionVault`

  return { subject, html, text }
}
