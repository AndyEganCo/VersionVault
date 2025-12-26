// Supabase Edge Function for automated version checking
// Triggered by cron jobs to check all software versions overnight
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractWithWebSearch, smartMergeNotes, getAIConfig } from '../_shared/ai-utils.ts'

// Declare EdgeRuntime for background task support
// This keeps the function alive after returning a response
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void
}

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

  // Use EdgeRuntime.waitUntil() to keep function alive after returning response
  // This prevents pg_cron's net.http_post timeout (~3 min) from killing the function
  // The function continues running in background while caller gets immediate 202 response

  // Define the background processing function
  const runVersionCheck = async (): Promise<void> => {
    try {
      console.log('🚀 Background version check starting...')

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
              // Progressive enhancement: Select up to 2 versions that need web search
              // Priority: Latest versions first, then fill in gaps in older versions
              // Mimics manual "Check for New Version" button behavior
              const versionsNeedingSearch: any[] = []
              const versionsToSkip: any[] = []

              for (const version of extracted.versions) {
                const normalizedVersion = normalizeVersion(version.version, software.name)

                if (versionsNeedingSearch.length < 2) {
                  // Check if version already exists and has good notes
                  const { data: existing } = await supabase
                    .from('software_version_history')
                    .select('search_sources, structured_notes')
                    .eq('software_id', software.id)
                    .eq('version', normalizedVersion)
                    .maybeSingle()

                  const needsSearch = !existing ||
                    (!existing.search_sources || existing.search_sources.length < 10) &&
                    (!existing.structured_notes || Object.keys(existing.structured_notes || {}).length < 3)

                  if (needsSearch) {
                    versionsNeedingSearch.push(version)
                  } else {
                    versionsToSkip.push(version)
                    console.log(`  💰 Skipping ${normalizedVersion} - already has good notes`)
                  }
                } else {
                  // Already have 2 to search, skip the rest
                  versionsToSkip.push(version)
                }
              }

              console.log(`  📊 Search plan: ${versionsNeedingSearch.length} to enhance, ${versionsToSkip.length} to skip`)

              // Process versions that need web search
              for (const version of versionsNeedingSearch) {
                // Normalize version number for consistent storage
                const normalizedVersion = normalizeVersion(version.version, software.name)

                // Check if version already exists
                const { data: existing } = await supabase
                  .from('software_version_history')
                  .select('id, notes_source, notes, structured_notes, search_sources')
                  .eq('software_id', software.id)
                  .eq('version', normalizedVersion)
                  .maybeSingle()

                let notesArray = typeof version.notes === 'string'
                  ? version.notes.split('\n').filter(Boolean)
                  : (Array.isArray(version.notes) ? version.notes : [])

                let structuredNotes = null
                let searchSources: string[] = []
                let notesSource: 'auto' | 'merged' = 'auto'
                let mergeMetadata = null

                // Perform web search for this version (already determined it needs it)
                if (aiConfig.web_search_enabled) {
                  console.log(`  🔍 Performing web search for ${normalizedVersion}...`)

                  const webSearchResult = await extractWithWebSearch(
                    software.name,
                    'Unknown', // manufacturer not in current schema
                    normalizedVersion,
                    software.website,
                    []
                  )

                  if (webSearchResult) {
                    console.log(`  ✅ Web search found detailed notes (${webSearchResult.sources.length} sources)`)
                    notesArray = webSearchResult.raw_notes
                    structuredNotes = webSearchResult.structured_notes
                    searchSources = webSearchResult.sources

                    // Use web search release date if found (more accurate than extraction)
                    if (webSearchResult.release_date) {
                      version.releaseDate = webSearchResult.release_date
                      console.log(`  📅 Found release date: ${webSearchResult.release_date}`)
                    }
                  }
                }

                if (existing) {
                  // Check if existing notes have meaningful content
                  const existingHasContent = existing.notes &&
                    Array.isArray(existing.notes) &&
                    existing.notes.length > 0 &&
                    existing.notes.some((note: string) => note && note.trim().length > 20)

                  // ALWAYS merge when existing has content, to preserve quality information
                  if (existingHasContent && notesSource === 'auto') {
                    console.log(`  🔀 Existing notes found, merging to preserve quality...`)

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
                    console.log(`  ✅ Notes merged successfully - quality preserved`)
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

              // Process skipped versions WITHOUT web search (already have good notes or not priority)
              for (const version of versionsToSkip) {
                const normalizedVersion = normalizeVersion(version.version, software.name)

                // Check if version already exists
                const { data: existing } = await supabase
                  .from('software_version_history')
                  .select('id')
                  .eq('software_id', software.id)
                  .eq('version', normalizedVersion)
                  .maybeSingle()

                // Only insert if it doesn't exist (no web search, no update needed)
                if (!existing) {
                  const notesArray = typeof version.notes === 'string'
                    ? version.notes.split('\n').filter(Boolean)
                    : (Array.isArray(version.notes) ? version.notes : [])

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
                    notes_source: 'auto',
                    notes_updated_at: now,
                    newsletter_verified: true,
                    verified_at: now,
                    detected_at: now,
                    created_at: now
                  }

                  const { error: insertError } = await supabase
                    .from('software_version_history')
                    .insert(insertData)

                  if (!insertError) {
                    versionsAdded++
                  }
                }
              }

              console.log(`  📦 Processed ${versionsAdded} new versions (${extracted.versions.length} total found, ${versionsNeedingSearch.length} enhanced with web search)`)
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

        // Process software in batches to avoid rate limits
        // Optimized for Supabase Pro tier (400 second / 6.67 min wall clock limit)
        // Batch size: 10 items at a time (increased for speed)
        // Delay: 10 seconds between batches (reduced to fit time limit)
        // 61 items = 7 batches, 6 delays × 10s = 60s delays, fits within limit
      const BATCH_SIZE = 10
      const BATCH_DELAY_MS = 10000 // 10 seconds

      console.log(`📊 Processing ${softwareList.length} software items in batches of ${BATCH_SIZE}`)
      const totalBatches = Math.ceil(softwareList.length / BATCH_SIZE)
      console.log(`⏱️  Estimated time: ~${totalBatches * (BATCH_DELAY_MS / 1000 + 10)} seconds`)
      console.log(`🔧 Using EdgeRuntime.waitUntil() for background processing`)

      const allResults: VersionCheckResult[] = []

      // Process in batches
      for (let i = 0; i < softwareList.length; i += BATCH_SIZE) {
        const batch = softwareList.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1

        console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`)

        // Process batch in parallel
        const batchResults = await Promise.all(batch.map(processSoftware))
        allResults.push(...batchResults)

        const batchSuccessful = batchResults.filter(r => r.success).length
        console.log(`✅ Batch ${batchNumber} complete: ${batchSuccessful} successful, ${batchResults.length - batchSuccessful} failed`)

        // Add delay between batches (except after the last batch)
        if (i + BATCH_SIZE < softwareList.length) {
          console.log(`⏸️  Waiting ${BATCH_DELAY_MS / 1000}s before next batch to avoid rate limits...`)
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
        }
      }

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

    } catch (error) {
      console.error('❌ Error in background version check:', error)
    }
  }

  // Start background processing - keeps function alive after response is sent
  EdgeRuntime.waitUntil(runVersionCheck())

  // Return immediately with 202 Accepted
  // The function continues running in background via EdgeRuntime.waitUntil()
  return new Response(
    JSON.stringify({
      status: 'accepted',
      message: 'Version check started in background. Check logs for progress.'
    }),
    {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
})
