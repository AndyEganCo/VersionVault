// Supabase Edge Function for web search-enhanced extraction
// Called by manual version checks to get detailed release notes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
      additionalDomains = []
    }: ExtractRequest = await req.json()

    console.log('🔍 Web search extraction request:', {
      software: softwareName,
      version,
      manufacturer
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

    // Call the web search extraction function
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
