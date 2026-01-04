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

    // Fetch all software with current versions, ordered consistently
    const { data: allSoftware, error: softwareError } = await supabase
      .from('software')
      .select('id, name, current_version')
      .order('id') // Consistent ordering by ID

    if (softwareError) {
      throw new Error(`Failed to fetch software: ${softwareError.message}`)
    }

    if (!allSoftware || allSoftware.length === 0) {
      console.log('⚠️ No software found to audit')
      return new Response(
        JSON.stringify({ message: 'No software to audit', flagged: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rotate through batches based on day of year
    // This ensures different software is checked each run
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const BATCH_SIZE = 15
    const MAX_BATCHES_PER_RUN = 1 // Process 15 items per run (reduced to prevent timeouts)
    const itemsPerRun = BATCH_SIZE * MAX_BATCHES_PER_RUN

    // Calculate which slice of software to check this run
    const totalRuns = Math.ceil(allSoftware.length / itemsPerRun)
    const currentRun = dayOfYear % totalRuns
    const startIndex = currentRun * itemsPerRun
    const endIndex = Math.min(startIndex + itemsPerRun, allSoftware.length)

    const software = allSoftware.slice(startIndex, endIndex)

    console.log(`📋 Auditing software ${startIndex + 1}-${endIndex} of ${allSoftware.length} (run ${currentRun + 1}/${totalRuns} for day ${dayOfYear})...`)

    // Split selected software into batches for API calls
    const batches: SoftwareItem[][] = []
    for (let i = 0; i < software.length; i += BATCH_SIZE) {
      batches.push(software.slice(i, i + BATCH_SIZE))
    }

    // Process all batches from this run's slice (should be exactly 1 batch = 15 items)
    console.log(`🔄 Processing ${batches.length} batch(es) of ${BATCH_SIZE} items each`)

    const allFlags: AuditFlag[] = []
    let totalApiTime = 0

    // Call OpenAI Responses API with web search (same as release notes extraction)
    // Using GPT-5 with agentic search for real-time version verification
    const chatGPTModel = 'gpt-5'

    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const batchNum = batchIndex + 1

      console.log(`\n🔍 Batch ${batchNum}/${batches.length}: Auditing ${batch.length} items with web search...`)

      // Prepare data for audit
      const softwareList = batch
        .map((s: SoftwareItem) => `- ${s.name}: ${s.current_version || 'No version tracked'}`)
        .join('\n')

      const prompt = `Today's date is ${new Date().toISOString().split('T')[0]}.

Search the web to verify if any of these software versions are outdated:

${softwareList}

For each software, search their official website for the current version number.

CRITICAL RULES:
- ONLY flag software if you find definitive proof on the official website that a newer version exists
- Do NOT flag based on your training data alone - you MUST verify via web search
- If you cannot find version information, DO NOT flag it
- Cite the source URL where you found the version

Respond with valid JSON in this exact format:
{
  "outdated": [
    {
      "software_name": "exact name from input",
      "current_version": "version from input",
      "suggested_version": "latest version found via web search",
      "confidence": "high",
      "reasoning": "Found on [URL]"
    }
  ],
  "summary": "brief summary"
}

If all software is up to date or you cannot verify, return: {"outdated": [], "summary": "All software appears up to date or could not be verified."}`

      const apiCallStart = Date.now()
      let content: string
      let sources: string[] = []

      try {
        // Use Responses API with web_search tool (same as ai-utils.ts)
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: chatGPTModel,
            reasoning: { effort: 'low' }, // Low effort for faster searches (was 'medium')
            tools: [{
              type: 'web_search',
              // No domain filtering - allow searching any official software sites
            }],
            tool_choice: 'auto',
            include: ['web_search_call.action.sources'],
            input: prompt,
          }),
        })

        const apiCallDuration = Date.now() - apiCallStart
        console.log(`⏱️  API call took ${apiCallDuration}ms`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Batch ${batchNum} API error:`, response.status, errorText)
          continue // Skip this batch
        }

        const result = await response.json()

        // Extract sources from web_search_call items
        const webSearchCalls = result.output?.filter((item: any) => item.type === 'web_search_call') || []
        for (const call of webSearchCalls) {
          if (call.action?.sources) {
            sources.push(...call.action.sources.map((s: any) => s.url || s))
          }
        }

        // Get the text output
        const messageItems = result.output?.filter((item: any) => item.type === 'message') || []
        content = messageItems[0]?.content?.find((c: any) => c.type === 'output_text')?.text || ''

        if (!content) {
          console.error(`❌ Batch ${batchNum} - No text content in response`)
          continue
        }

        console.log(`✅ Batch ${batchNum} - Web search completed (${webSearchCalls.length} searches, ${sources.length} sources)`)
        totalApiTime += apiCallDuration
      } catch (error) {
        console.error(`❌ Batch ${batchNum} - Error:`, error.message)
        continue
      }

      // Parse response
      let parsedResponse: ChatGPTResponse
      try {
        parsedResponse = JSON.parse(content)
      } catch (e) {
        console.error(`❌ Batch ${batchNum} - Failed to parse response:`, content)
        continue
      }

      console.log(`🎯 Batch ${batchNum}: Found ${parsedResponse.outdated.length} outdated items`)
      if (parsedResponse.outdated.length > 0) {
        console.log(`📝 Summary: ${parsedResponse.summary}`)
        console.log(`📚 Sources consulted: ${sources.slice(0, 5).join(', ')}${sources.length > 5 ? '...' : ''}`)
      }

      // Add to overall results
      allFlags.push(...parsedResponse.outdated)
    } // End of batch loop

    console.log(`\n✅ Batch processing complete!`)
    console.log(`   Processed: ${batches.length} batches`)
    console.log(`   Items audited: ${software.length}`)
    console.log(`   Total API time: ${totalApiTime}ms`)
    console.log(`   Total flagged: ${allFlags.length} potentially outdated software`)

    // Create audit run record
    const auditRunId = crypto.randomUUID()
    const executionTime = Date.now() - startTime

    const { error: runInsertError } = await supabase
      .from('version_audit_runs')
      .insert({
        id: auditRunId,
        total_software_checked: software.length,
        flags_created: allFlags.length,
        chatgpt_model: chatGPTModel,
        execution_time_ms: executionTime,
      })

    if (runInsertError) {
      console.error('⚠️ Failed to insert audit run:', runInsertError)
    }

    // If no outdated software found, we're done
    if (allFlags.length === 0) {
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
          summary: 'All software appears up to date based on available knowledge.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create flags for outdated software
    const flags: any[] = []
    const flaggedSoftware: { name: string, current: string, suggested: string, confidence: string }[] = []

    for (const item of allFlags) {
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
      const summary = `Found ${allFlags.length} potentially outdated software (audited items ${startIndex + 1}-${endIndex} of ${allSoftware.length} this run).`
      const { subject, html, text } = generateEmailContent({
        flaggedSoftware,
        totalAudited: software.length,
        summary,
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
    console.log(`   Items audited: ${software.length} (${startIndex + 1}-${endIndex} of ${allSoftware.length} total)`)
    console.log(`   Flagged: ${flags.length} potentially outdated`)
    console.log(`   Run: ${currentRun + 1} of ${totalRuns}`)
    console.log(`   Execution time: ${executionTime}ms`)

    const finalSummary = `Found ${flags.length} outdated items (audited ${startIndex + 1}-${endIndex} of ${allSoftware.length}). Rotation ${currentRun + 1}/${totalRuns}.`

    return new Response(
      JSON.stringify({
        message: 'Version audit complete',
        audited: software.length,
        total_software: allSoftware.length,
        range_start: startIndex + 1,
        range_end: endIndex,
        flagged: flags.length,
        rotation: `${currentRun + 1}/${totalRuns}`,
        summary: finalSummary,
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
