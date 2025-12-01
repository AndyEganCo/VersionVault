// Supabase Edge Function for automated version checking
// Triggered by cron jobs to check all software versions overnight
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VersionCheckResult {
  softwareId: string
  name: string
  success: boolean
  versionsFound: number
  error?: string
}

interface CheckSummary {
  totalChecked: number
  successful: number
  failed: number
  totalVersionsAdded: number
  results: VersionCheckResult[]
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to trigger-version-check`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    console.log('🔐 Checking authorization...')
    console.log(`   Auth header present: ${!!authHeader}`)
    console.log(`   CRON_SECRET set: ${!!cronSecret}`)

    if (!authHeader) {
      console.error('❌ No Authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No Authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured in environment')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: CRON_SECRET not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the secret matches
    const providedSecret = authHeader.replace('Bearer ', '')
    if (providedSecret !== cronSecret) {
      console.error('❌ Invalid CRON_SECRET provided')
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Authorization successful')
    console.log('🔄 Starting automated version check...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all software that has a version_website configured
    const { data: softwareList, error: fetchError } = await supabase
      .from('software')
      .select('id, name, website, version_website, current_version')
      .not('version_website', 'is', null)
      .neq('version_website', '')

    if (fetchError) {
      throw new Error(`Failed to fetch software: ${fetchError.message}`)
    }

    console.log(`📋 Found ${softwareList.length} software to check`)

    const results: VersionCheckResult[] = []
    let totalVersionsAdded = 0

    // Process each software
    for (const software of softwareList) {
      console.log(`\n🔍 Checking: ${software.name}`)

      try {
        // Call extract-software-info edge function
        const extractUrl = `${supabaseUrl}/functions/v1/extract-software-info`
        console.log(`  📡 Calling extract-software-info for ${software.name}`)
        console.log(`     URL: ${software.version_website}`)

        const response = await fetch(extractUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            name: software.name,
            website: software.website,
            versionUrl: software.version_website,
            description: `Current version: ${software.current_version || 'unknown'}`
          })
        })

        console.log(`  📊 Extract response status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`  ❌ Extract function error: ${errorText}`)
          throw new Error(`Extract function returned ${response.status}: ${errorText}`)
        }

        const extracted = await response.json()
        console.log(`  📦 Extracted data:`, {
          currentVersion: extracted.currentVersion,
          versionsCount: extracted.versions?.length || 0,
          hasReleaseDate: !!extracted.releaseDate
        })

        // Update software with latest version
        if (extracted.currentVersion) {
          await supabase
            .from('software')
            .update({
              current_version: extracted.currentVersion,
              release_date: extracted.releaseDate || null,
              last_checked: new Date().toISOString()
            })
            .eq('id', software.id)

          console.log(`  ✅ Updated to version ${extracted.currentVersion}`)
        }

        // Save all versions to database
        let versionsAdded = 0
        if (extracted.versions && extracted.versions.length > 0) {
          for (const version of extracted.versions) {
            // Check if version already exists
            const { data: existing } = await supabase
              .from('software_version_history')
              .select('id')
              .eq('software_id', software.id)
              .eq('version', version.version)
              .single()

            const notesArray = typeof version.notes === 'string'
              ? version.notes.split('\n').filter(Boolean)
              : version.notes

            if (existing) {
              // Update existing version
              await supabase
                .from('software_version_history')
                .update({
                  release_date: version.releaseDate,
                  notes: notesArray,
                  type: version.type
                })
                .eq('id', existing.id)
            } else {
              // Insert new version
              await supabase
                .from('software_version_history')
                .insert({
                  software_id: software.id,
                  version: version.version,
                  release_date: version.releaseDate,
                  notes: notesArray,
                  type: version.type,
                  created_at: new Date().toISOString()
                })

              versionsAdded++
            }
          }

          console.log(`  📦 Added ${versionsAdded} new versions (${extracted.versions.length} total found)`)
          totalVersionsAdded += versionsAdded
        }

        results.push({
          softwareId: software.id,
          name: software.name,
          success: true,
          versionsFound: extracted.versions?.length || 0
        })

      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`)
        results.push({
          softwareId: software.id,
          name: software.name,
          success: false,
          versionsFound: 0,
          error: error.message
        })
      }

      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const summary: CheckSummary = {
      totalChecked: softwareList.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalVersionsAdded,
      results
    }

    console.log('\n✅ Version check complete!')
    console.log(`   Total checked: ${summary.totalChecked}`)
    console.log(`   Successful: ${summary.successful}`)
    console.log(`   Failed: ${summary.failed}`)
    console.log(`   New versions added: ${summary.totalVersionsAdded}`)

    return new Response(
      JSON.stringify(summary),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in trigger-version-check:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
