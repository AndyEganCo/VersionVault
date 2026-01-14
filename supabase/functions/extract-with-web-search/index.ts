// Supabase Edge Function for web search-enhanced extraction
// Called by manual version checks to get detailed release notes
// HYBRID APPROACH: Returns immediately (202) and processes in background

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9'
import { extractWithWebSearch } from '../_shared/ai-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractRequest {
  softwareName: string
  manufacturer: string
  version: string
  websiteUrl: string
  additionalDomains?: string[]
  softwareId?: string  // Optional: for direct database updates
  async?: boolean      // Optional: force async mode (default: true)
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    const {
      softwareName,
      manufacturer,
      version,
      websiteUrl,
      additionalDomains = [],
      softwareId,
      async = true  // Default to async mode
    }: ExtractRequest = await req.json()

    console.log('🔍 Web search extraction request:', {
      software: softwareName,
      version,
      manufacturer,
      mode: async ? 'async' : 'sync'
    })

    // Validate input
    if (!softwareName || !version || !websiteUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: softwareName, version, websiteUrl'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // HYBRID APPROACH: Return immediately and process in background
    if (async) {
      // Generate request ID for tracking
      const requestId = crypto.randomUUID()

      console.log(`📤 Returning 202 Accepted (request_id: ${requestId})`)

      // Return immediately
      const response = new Response(
        JSON.stringify({
          status: 'processing',
          request_id: requestId,
          message: 'Web search started in background'
        }),
        {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

      // Process in background (leverages Pro tier 400s wall clock limit)
      // Note: This continues after response is sent
      const backgroundTask = async () => {
        try {
          console.log(`🚀 Background processing started (request_id: ${requestId})`)

          // Call the web search extraction function with optimizations
          const result = await extractWithWebSearch(
            softwareName,
            manufacturer,
            version,
            websiteUrl,
            additionalDomains
          )

          if (!result) {
            console.log(`⚠️ Background: Web search returned null (request_id: ${requestId})`)
            return
          }

          console.log(`✅ Background: Web search complete (request_id: ${requestId})`)

          // If softwareId provided, update database directly
          if (softwareId) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            const supabase = createClient(supabaseUrl, supabaseKey)

            // Update or insert version history with enhanced notes
            const { error } = await supabase
              .from('software_version_history')
              .upsert({
                software_id: softwareId,
                version: result.version,
                release_date: result.release_date || null,
                notes: result.raw_notes.join('\n'),
                structured_notes: result.structured_notes,
                search_sources: result.sources,
                notes_source: 'auto',
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'software_id,version'
              })

            if (error) {
              console.error(`❌ Background: DB update failed (request_id: ${requestId}):`, error)
            } else {
              console.log(`✅ Background: DB updated (request_id: ${requestId})`)
            }
          }

        } catch (error) {
          console.error(`❌ Background processing error (request_id: ${requestId}):`, error)
        }
      }

      // Start background task (doesn't block response)
      backgroundTask()

      return response
    }

    // SYNCHRONOUS MODE (for backward compatibility or testing)
    console.log('🔄 Running in synchronous mode')

    const result = await extractWithWebSearch(
      softwareName,
      manufacturer,
      version,
      websiteUrl,
      additionalDomains
    )

    if (!result) {
      console.log('⚠️ Web search extraction returned null (likely disabled or limit reached)')
      return new Response(
        JSON.stringify({
          raw_notes: [],
          structured_notes: {},
          sources: [],
          message: 'Web search not available (disabled or limit reached)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Web search extraction successful')

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Web search extraction error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
