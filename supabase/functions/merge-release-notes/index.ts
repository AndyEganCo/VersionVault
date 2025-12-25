// Supabase Edge Function for AI-powered release notes merging
// Intelligently combines manual and auto-extracted release notes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { smartMergeNotes } from '../_shared/ai-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MergeRequest {
  existingNotes: {
    notes: string[]
    structured_notes?: any
    notes_source?: string
  }
  newNotes: {
    notes: string[]
    structured_notes?: any
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { existingNotes, newNotes }: MergeRequest = await req.json()

    console.log('🔀 Merge request received:', {
      existing_source: existingNotes.notes_source,
      existing_notes_count: existingNotes.notes?.length || 0,
      new_notes_count: newNotes.notes?.length || 0
    })

    // Validate input
    if (!existingNotes || !newNotes) {
      return new Response(
        JSON.stringify({ error: 'Missing existingNotes or newNotes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call the smart merge function
    const result = await smartMergeNotes(existingNotes, newNotes)

    console.log('✅ Merge completed successfully')

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Merge error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
