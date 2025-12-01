// Supabase Edge Function for AI-powered software info extraction
// This keeps the OpenAI API key secure on the server side
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractRequest {
  name: string
  website: string
  versionUrl: string
  description?: string
}

interface ExtractedInfo {
  manufacturer: string
  category: string
  currentVersion?: string
  releaseDate?: string
}

/**
 * Fetches webpage content and extracts text, with intelligent content limits
 */
async function fetchWebpageContent(url: string, maxChars: number = 30000): Promise<string> {
  try {
    console.log(`Fetching webpage: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    // Try to find main content areas first (more intelligent extraction)
    const selectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '.release-notes',
      '.changelog',
      '.version-info'
    ]

    let content = ''

    // Try to extract from semantic elements first
    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element?.textContent) {
        content = element.textContent
        console.log(`Found content in ${selector}`)
        break
      }
    }

    // Fallback to body if no semantic elements found
    if (!content) {
      content = doc.body?.textContent || ''
      console.log('Using full body content')
    }

    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()

    // Limit to specified character count
    const limitedContent = content.substring(0, maxChars)
    console.log(`Extracted ${limitedContent.length} characters from ${url}`)

    return limitedContent
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return ''
  }
}

/**
 * Calls OpenAI to extract software information
 */
async function extractWithAI(
  name: string,
  website: string,
  versionUrl: string,
  versionContent: string,
  mainWebsiteContent: string,
  description?: string
): Promise<ExtractedInfo> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const hasVersionContent = versionContent.length > 100
  const hasMainContent = mainWebsiteContent.length > 100

  const prompt = `You are a software information expert. Analyze the provided website content and extract software details.

Software Details:
- Name: ${name}
- Website: ${website}
- Version URL: ${versionUrl}
${description ? `- Description: ${description}` : ''}

${hasVersionContent ? `
Version Page Content (from ${versionUrl}):
${versionContent}
` : ''}

${hasMainContent ? `
Main Website Content (from ${website}):
${mainWebsiteContent}
` : ''}

${!hasVersionContent && !hasMainContent ? `
Note: Unable to fetch content from either URL. Please use your knowledge about this software to provide accurate information.
` : ''}

TASK: Extract the following information:

1. **Manufacturer/Company Name**: The company that makes this software
2. **Category**: Choose EXACTLY ONE from this list:
   - Audio Production
   - Video Production
   - Presentation & Playback
   - Lighting Control
   - Show Control
   - Design & Planning
   - Network & Control
   - Project Management

3. **Current Version**: The latest version number (e.g., "2.1.3", "2024.1")
   - Look in the version page content first
   - If not found there, check the main website content
   - If still not found, use null

4. **Release Date**: The date the current version was released (format: YYYY-MM-DD)
   - Look for dates associated with the latest version
   - If not found or uncertain, use null

IMPORTANT INSTRUCTIONS:
- Search BOTH the version page AND main website content for version information
- Look for patterns like "Version 1.2.3", "v1.2.3", "Release 1.2.3", "1.2.3 released", etc.
- Release dates might be formatted various ways (convert to YYYY-MM-DD)
- If you cannot find version/date in the provided content, return null (not an empty string)
- For category, choose the EXACT category name from the list (case-sensitive)

Respond in JSON format:
{
  "manufacturer": "Company Name",
  "category": "Exact Category Name",
  "currentVersion": "version number or null",
  "releaseDate": "YYYY-MM-DD or null"
}`

  console.log('Calling OpenAI API...')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts software information and returns only valid JSON. Be thorough in searching all provided content for version information.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const result = data.choices[0].message.content

  if (!result) {
    throw new Error('No response from OpenAI')
  }

  const extracted = JSON.parse(result) as ExtractedInfo

  // Validate required fields
  if (!extracted.manufacturer || !extracted.category) {
    throw new Error('Invalid response from AI - missing required fields')
  }

  // Clean up null values
  if (extracted.currentVersion === null || extracted.currentVersion === 'null') {
    delete extracted.currentVersion
  }
  if (extracted.releaseDate === null || extracted.releaseDate === 'null') {
    delete extracted.releaseDate
  }

  console.log('Extraction successful:', extracted)
  return extracted
}

/**
 * Fallback extraction from domain name
 */
function extractFromDomain(website: string): ExtractedInfo {
  try {
    const url = new URL(website)
    const domain = url.hostname.replace('www.', '')
    const parts = domain.split('.')

    let manufacturer = parts[0]
    manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1)

    return {
      manufacturer,
      category: 'Show Control'
    }
  } catch {
    return {
      manufacturer: 'Unknown',
      category: 'Show Control'
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, website, versionUrl, description } = await req.json() as ExtractRequest

    if (!name || !website || !versionUrl) {
      return new Response(
        JSON.stringify({ error: 'name, website, and versionUrl are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Processing extraction for: ${name}`)
    console.log(`Version URL: ${versionUrl}`)
    console.log(`Main Website: ${website}`)

    // Fetch content from both URLs in parallel
    const [versionContent, mainWebsiteContent] = await Promise.all([
      fetchWebpageContent(versionUrl, 30000),
      // Only fetch main website if it's different from version URL
      versionUrl.toLowerCase() !== website.toLowerCase()
        ? fetchWebpageContent(website, 20000)
        : Promise.resolve('')
    ])

    console.log(`Version content length: ${versionContent.length}`)
    console.log(`Main website content length: ${mainWebsiteContent.length}`)

    // Try AI extraction
    let extracted: ExtractedInfo
    try {
      extracted = await extractWithAI(
        name,
        website,
        versionUrl,
        versionContent,
        mainWebsiteContent,
        description
      )
    } catch (aiError) {
      console.error('AI extraction failed:', aiError)
      // Fallback to domain extraction
      console.log('Using fallback domain extraction')
      extracted = extractFromDomain(website)
    }

    return new Response(
      JSON.stringify(extracted),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in extract-software-info:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        manufacturer: 'Unknown',
        category: 'Show Control'
      }),
      {
        status: 200, // Return 200 with fallback data
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
