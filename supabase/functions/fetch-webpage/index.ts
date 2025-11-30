// Supabase Edge Function to fetch webpage content (bypasses CORS)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

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
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching webpage:', url)

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()

    // Parse HTML and extract text content
    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    const bodyText = doc.body?.textContent || ''

    // Limit to first 3000 characters to avoid token limits
    const content = bodyText.substring(0, 3000)

    console.log(`Fetched ${content.length} characters from ${url}`)

    return new Response(
      JSON.stringify({ content }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error fetching webpage:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        content: '' // Return empty content on error
      }),
      {
        status: 200, // Return 200 so client can handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
