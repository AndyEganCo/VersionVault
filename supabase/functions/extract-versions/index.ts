// Supabase Edge Function to extract ALL versions from release notes pages
// Uses Browserless for JavaScript pages and GPT-4o for extraction
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractRequest {
  softwareName: string
  url: string
}

interface ExtractedVersion {
  version: string
  releaseDate: string
  notes: string
  type: 'major' | 'minor' | 'patch'
}

/**
 * Fetches with Browserless for JavaScript pages
 */
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set')
    return ''
  }

  try {
    const response = await fetch(`https://chrome.browserless.io/content?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      throw new Error(`Browserless error: ${response.status}`)
    }

    return await response.text()
  } catch (error) {
    console.error(`Browserless failed for ${url}:`, error)
    return ''
  }
}

/**
 * Fetches webpage content
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    // Try regular fetch first
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    let textContent = doc.body?.textContent || ''

    // If very low content, try Browserless
    if (textContent.trim().length < 2000) {
      console.log('Low content detected, trying Browserless...')
      const browserlessHtml = await fetchWithBrowserless(url)

      if (browserlessHtml) {
        const browserlessDoc = new DOMParser().parseFromString(browserlessHtml, 'text/html')
        textContent = browserlessDoc?.body?.textContent || textContent
      }
    }

    // Clean up
    textContent = textContent.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim()

    // Limit to 50k chars for AI processing
    return textContent.substring(0, 50000)
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return ''
  }
}

/**
 * Extract all versions using OpenAI
 */
async function extractVersionsWithAI(softwareName: string, content: string): Promise<ExtractedVersion[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const prompt = `Extract ALL versions from these ${softwareName} release notes.

Content:
${content}

TASK: Find EVERY version mentioned and extract:
1. Version number (e.g., "1.5.0", "v2.3", "r32.1")
2. Release date (convert to YYYY-MM-DD format)
3. Release notes/changelog (keep detailed, use markdown)
4. Type: "major" for X.0.0, "minor" for X.X.0, "patch" for X.X.X

IMPORTANT:
- Extract ALL versions in the content (not just the latest)
- Include full release notes for each version
- Format dates as YYYY-MM-DD
- Use markdown formatting for notes
- Return empty array if no versions found

Return ONLY valid JSON array:
[
  {
    "version": "1.5.0",
    "releaseDate": "2024-11-29",
    "notes": "## New Features\\n- Feature 1\\n- Feature 2\\n\\n## Bug Fixes\\n- Fix 1",
    "type": "minor"
  }
]`

  console.log('Calling OpenAI to extract all versions...')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a release notes parser. Extract ALL versions with complete details. Return only valid JSON array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  let result = data.choices[0].message.content

  console.log('=== AI RESPONSE ===')
  console.log(result)
  console.log('===================')

  if (!result) {
    return []
  }

  // Clean up response
  result = result.trim()
  if (result.startsWith('```json')) {
    result = result.replace(/^```json\s*/i, '').replace(/```\s*$/, '')
  } else if (result.startsWith('```')) {
    result = result.replace(/^```\s*/, '').replace(/```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(result)
    // Handle both array and object with versions array
    if (Array.isArray(parsed)) {
      return parsed
    } else if (parsed.versions && Array.isArray(parsed.versions)) {
      return parsed.versions
    }
    return []
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { softwareName, url } = await req.json() as ExtractRequest

    if (!softwareName || !url) {
      return new Response(
        JSON.stringify({ error: 'softwareName and url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Extracting versions for: ${softwareName}`)
    console.log(`URL: ${url}`)

    // Fetch page content
    const content = await fetchPageContent(url)
    console.log(`Fetched ${content.length} characters`)

    if (!content || content.length < 100) {
      return new Response(
        JSON.stringify({ versions: [], error: 'No content found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract versions with AI
    const versions = await extractVersionsWithAI(softwareName, content)
    console.log(`Extracted ${versions.length} versions`)

    return new Response(
      JSON.stringify({ versions }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in extract-versions:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        versions: []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
