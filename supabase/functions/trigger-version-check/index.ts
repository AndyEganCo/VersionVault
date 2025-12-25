// Supabase Edge Function for automated version checking
// Triggered by cron jobs to check all software versions overnight
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractWithWebSearch, smartMergeNotes, getAIConfig } from '../_shared/ai-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VersionCheckResult {
  softwareId: string
  name: string
  success: boolean
  versionsFound: number
  versionsAdded: number
  error?: string
}

interface CheckSummary {
  totalChecked: number
  successful: number
  failed: number
  totalVersionsAdded: number
  results: VersionCheckResult[]
}

/**
 * Normalize version numbers for software that uses non-standard formats
 * For disguise: strip the 'r' prefix (e.g., "r32.2" -> "32.2")
 */
function normalizeVersion(version: string, softwareName: string): string {
  const lowerName = softwareName.toLowerCase()

  // Handle disguise versions - strip 'r' prefix
  if (lowerName.includes('disguise') || lowerName.includes('designer')) {
    // Match versions like "r32.2", "r32.1.4" but not "version 32.2"
    const match = version.match(/^r(\d+(?:\.\d+)*)$/i)
    if (match) {
      return match[1]
    }
  }

  return version
}

serve(async (req) => {
  console.log(`📥 Received ${req.method} request to trigger-version-check`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization - check multiple sources
    const authHeader = req.headers.get('Authorization')
    const customSecretHeader = req.headers.get('X-Cron-Secret')
    const cronSecret = Deno.env.get('CRON_SECRET')

    console.log('🔐 Checking authorization...')
    console.log(`   Auth header present: ${!!authHeader}`)
    console.log(`   Custom secret header present: ${!!customSecretHeader}`)
    console.log(`   CRON_SECRET set: ${!!cronSecret}`)

    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured in environment')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: CRON_SECRET not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check custom secret header first (for custom auth)
    let isAuthorized = false

    if (customSecretHeader) {
      console.log('   Checking X-Cron-Secret header')
      if (customSecretHeader === cronSecret) {
        isAuthorized = true
      }
    }

    // Then check Authorization header (Bearer token)
    if (!isAuthorized && authHeader) {
      console.log('   Checking Authorization header')
      const providedSecret = authHeader.replace('Bearer ', '')
      if (providedSecret === cronSecret) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      console.error('❌ Invalid or missing credentials')
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      .select('id, name, website, version_website, current_version, source_type, forum_config')
      .not('version_website', 'is', null)
      .neq('version_website', '')

    if (fetchError) {
      throw new Error(`Failed to fetch software: ${fetchError.message}`)
    }

    console.log(`📋 Found ${softwareList.length} software to check`)

    const results: VersionCheckResult[] = []
    let totalVersionsAdded = 0

    // Helper function to process a single software item
    const processSoftware = async (software: any): Promise<VersionCheckResult> => {
      console.log(`🔍 Checking: ${software.name}`)

      try {
        // Call extract-software-info edge function
        const extractUrl = `${supabaseUrl}/functions/v1/extract-software-info`
        console.log(`  📡 Calling extract-software-info for ${software.name}`)

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
            description: `Current version: ${software.current_version || 'unknown'}`,
            sourceType: software.source_type || 'webpage',
            forumConfig: software.forum_config || undefined
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

        // Always update last_checked timestamp, regardless of version found
        const updateData: any = {
          last_checked: new Date().toISOString()
        }

        // Update with new version if found
        if (extracted.currentVersion) {
          // Normalize version for consistent storage
          updateData.current_version = normalizeVersion(extracted.currentVersion, software.name)
          updateData.release_date = extracted.releaseDate || null
        }

        await supabase
          .from('software')
          .update(updateData)
          .eq('id', software.id)

        if (extracted.currentVersion) {
          console.log(`  ✅ Updated to version ${extracted.currentVersion}`)
        } else {
          console.log(`  ⏭️  No new version found, updated last_checked`)
        }

        // Save all versions to database
        let versionsAdded = 0
        const aiConfig = await getAIConfig()

        if (extracted.versions && extracted.versions.length > 0) {
          for (const version of extracted.versions) {
            // Normalize version number for consistent storage
            const normalizedVersion = normalizeVersion(version.version, software.name)

            // Check if version already exists
            const { data: existing } = await supabase
              .from('software_version_history')
              .select('id, notes_source, notes, structured_notes')
              .eq('software_id', software.id)
              .eq('version', normalizedVersion)
              .single()

            let notesArray = typeof version.notes === 'string'
              ? version.notes.split('\n').filter(Boolean)
              : (Array.isArray(version.notes) ? version.notes : [])

            let structuredNotes = null
            let searchSources: string[] = []
            let notesSource: 'auto' | 'merged' = 'auto'
            let mergeMetadata = null

            // Try enhanced extraction with web search for new versions
            if (!existing && aiConfig.web_search_enabled) {
              console.log(`  🔍 Attempting web search for ${normalizedVersion}...`)

              const webSearchResult = await extractWithWebSearch(
                software.name,
                'Unknown', // manufacturer not in current schema
                normalizedVersion,
                software.website,
                []
              )

              if (webSearchResult) {
                console.log(`  ✅ Web search found detailed notes`)
                notesArray = webSearchResult.raw_notes
                structuredNotes = webSearchResult.structured_notes
                searchSources = webSearchResult.sources
              }
            }

            if (existing) {
              // Check if existing notes are manual
              const isManual = existing.notes_source === 'manual'

              if (isManual) {
                // Smart merge: combine manual + new auto notes
                console.log(`  🔀 Merging manual notes with new auto-extracted notes...`)

                const mergeResult = await smartMergeNotes(
                  {
                    notes: existing.notes || [],
                    structured_notes: existing.structured_notes,
                    notes_source: existing.notes_source
                  },
                  {
                    structured_notes: structuredNotes || {},
                    raw_notes: notesArray
                  }
                )

                notesArray = mergeResult.raw_notes
                structuredNotes = mergeResult.structured_notes
                notesSource = 'merged'
                mergeMetadata = mergeResult.merge_metadata
                console.log(`  ✅ Notes merged successfully`)
              }

              // Update existing version
              const updateData: any = {
                notes: notesArray,
                type: version.type,
                notes_source: notesSource,
                notes_updated_at: new Date().toISOString()
              }

              if (structuredNotes) {
                updateData.structured_notes = structuredNotes
              }

              if (searchSources.length > 0) {
                updateData.search_sources = searchSources
              }

              if (mergeMetadata) {
                updateData.merge_metadata = mergeMetadata
              }

              // Only update release_date if a valid date is provided
              if (version.releaseDate && version.releaseDate !== 'null') {
                updateData.release_date = version.releaseDate
              }

              const { error: updateError } = await supabase
                .from('software_version_history')
                .update(updateData)
                .eq('id', existing.id)

              if (updateError) {
                console.error(`  ❌ Failed to update version ${normalizedVersion}: ${updateError.message}`)
                throw updateError
              }
            } else {
              // Insert new version
              const releaseDate = (version.releaseDate && version.releaseDate !== 'null')
                ? version.releaseDate
                : new Date().toISOString()

              const now = new Date().toISOString()
              const insertData: any = {
                software_id: software.id,
                version: normalizedVersion,
                release_date: releaseDate,
                notes: notesArray,
                type: version.type,
                notes_source: notesSource,
                notes_updated_at: now,
                newsletter_verified: true,
                verified_at: now,
                detected_at: now,
                created_at: now
              }

              if (structuredNotes) {
                insertData.structured_notes = structuredNotes
              }

              if (searchSources.length > 0) {
                insertData.search_sources = searchSources
              }

              const { error: insertError } = await supabase
                .from('software_version_history')
                .insert(insertData)

              if (insertError) {
                console.error(`  ❌ Failed to insert version ${normalizedVersion}: ${insertError.message}`)
                throw insertError
              }

              versionsAdded++
            }
          }

          console.log(`  📦 Added ${versionsAdded} new versions (${extracted.versions.length} total found)`)
        }

        return {
          softwareId: software.id,
          name: software.name,
          success: true,
          versionsFound: extracted.versions?.length || 0,
          versionsAdded
        }

      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}`)
        return {
          softwareId: software.id,
          name: software.name,
          success: false,
          versionsFound: 0,
          versionsAdded: 0,
          error: error.message
        }
      }
    }

    // Process all software concurrently to maximize throughput and minimize execution time
    console.log(`📊 Processing ${softwareList.length} software items concurrently`)

    // Process all items in parallel using Promise.all
    const allResults = await Promise.all(softwareList.map(processSoftware))

    // Aggregate results and count new versions
    for (const result of allResults) {
      results.push(result)
      totalVersionsAdded += result.versionsAdded
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
