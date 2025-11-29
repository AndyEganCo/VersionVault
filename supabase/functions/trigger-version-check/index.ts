import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
    })

    // Fetch all software with version_website URLs
    const { data: softwareList, error: fetchError } = await supabaseClient
      .from('software')
      .select('id, name, version_website, current_version')
      .not('version_website', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    const results = []

    for (const software of softwareList || []) {
      try {
        console.log(`Checking version for ${software.name}...`)

        // Fetch the webpage content
        const response = await fetch(software.version_website)
        const html = await response.text()

        // Extract version using OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a version detection specialist. Extract ONLY the version number from the provided text. Return ONLY the version number, nothing else. If no version is found, return null.'
            },
            {
              role: 'user',
              content: `Find the latest version number for ${software.name} from this text: ${html.substring(0, 2000)}`
            }
          ]
        })

        const detectedVersion = completion.choices[0].message.content
        const version = detectedVersion === 'null' ? null : detectedVersion?.trim()

        console.log(`Detected version for ${software.name}: ${version}`)

        // Save the version check result
        const { error: checkError } = await supabaseClient
          .from('version_checks')
          .insert({
            software_id: software.id,
            url: software.version_website,
            detected_version: version,
            current_version: software.current_version,
            status: version ? 'success' : 'error',
            error: version ? null : 'No version detected',
            content: html.substring(0, 1000),
            source: 'openai',
            confidence: version ? 0.9 : 0,
            checked_at: new Date().toISOString(),
            is_beta: false
          })

        if (checkError) {
          console.error(`Error saving check for ${software.name}:`, checkError)
        }

        // If we detected a new version, update the software table
        if (version && version !== software.current_version) {
          console.log(`New version detected for ${software.name}: ${version} (was ${software.current_version})`)

          // Update software table
          const { error: updateError } = await supabaseClient
            .from('software')
            .update({
              current_version: version,
              last_checked: new Date().toISOString()
            })
            .eq('id', software.id)

          if (updateError) {
            console.error(`Error updating software ${software.name}:`, updateError)
          }

          // Add to version history
          const { error: historyError } = await supabaseClient
            .from('software_version_history')
            .insert({
              id: crypto.randomUUID(),
              software_id: software.id,
              version: version,
              release_date: new Date().toISOString(),
              notes: [`Version ${version} detected automatically`],
              type: 'minor',
              created_at: new Date().toISOString()
            })

          if (historyError) {
            console.error(`Error adding version history for ${software.name}:`, historyError)
          }

          results.push({
            software: software.name,
            oldVersion: software.current_version,
            newVersion: version,
            status: 'updated'
          })
        } else if (version) {
          // Just update last_checked
          await supabaseClient
            .from('software')
            .update({ last_checked: new Date().toISOString() })
            .eq('id', software.id)

          results.push({
            software: software.name,
            version: version,
            status: 'up-to-date'
          })
        } else {
          results.push({
            software: software.name,
            status: 'error',
            error: 'Could not detect version'
          })
        }
      } catch (error) {
        console.error(`Error processing ${software.name}:`, error)
        results.push({
          software: software.name,
          status: 'error',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: softwareList?.length || 0,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in trigger-version-check:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
