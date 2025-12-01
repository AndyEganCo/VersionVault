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
  isJavaScriptPage?: boolean  // Flag for pages that likely need browser rendering
  lowContentWarning?: string  // Warning message if content was insufficient
  versions?: Array<{           // Array of ALL versions found on the page
    version: string
    releaseDate: string
    notes: string
    type: 'major' | 'minor' | 'patch'
  }>
}

/**
 * Fetches webpage content using Browserless (headless Chrome) for JavaScript rendering
 */
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set, skipping browser rendering')
    return ''
  }

  try {
    console.log(`🌐 Fetching with Browserless (headless Chrome): ${url}`)

    const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}`

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url
        // /content endpoint automatically waits for JS to execute
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Browserless error: ${response.status} - ${error}`)
    }

    const html = await response.text()
    console.log(`✅ Browserless fetched ${html.length} characters`)
    return html

  } catch (error) {
    console.error(`❌ Browserless fetch failed for ${url}:`, error)
    return ''
  }
}

/**
 * Fetches webpage content and extracts text, with intelligent content limits
 */
async function fetchWebpageContent(url: string, maxChars: number = 30000, useBrowserless: boolean = false): Promise<string> {
  try {
    console.log(`Fetching webpage: ${url}${useBrowserless ? ' (with Browserless)' : ''}`)

    let html: string

    if (useBrowserless) {
      // Use Browserless for JavaScript-heavy pages
      html = await fetchWithBrowserless(url)

      if (!html) {
        console.warn('Browserless failed, falling back to regular fetch')
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
          },
        })
        html = await response.text()
      }
    } else {
      // Regular fetch for static pages
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      html = await response.text()
    }
    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    // Try to find main content areas first (more intelligent extraction)
    // Added wiki-specific selectors and documentation page patterns
    const selectors = [
      // Wiki-specific selectors
      '.wiki-content',
      '#wiki-content',
      '.mw-parser-output',
      '#mw-content-text',
      '.page-content',
      '#page-content',
      '.markdown-body',
      '.md-content',

      // Release notes / changelog specific
      '.release-notes',
      '.changelog',
      '.version-info',
      '#release-notes',
      '#changelog',

      // Generic semantic selectors
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '#content',
      '.post-content',
      '.entry-content'
    ]

    let content = ''

    // Try to extract from semantic elements first
    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element?.textContent && element.textContent.trim().length > 200) {
        content = element.textContent
        console.log(`Found content in ${selector} (${content.length} chars)`)
        break
      }
    }

    // Fallback to body if no semantic elements found
    if (!content || content.trim().length < 200) {
      content = doc.body?.textContent || ''
      console.log(`Using full body content (${content.length} chars)`)
    }

    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()

    // Limit to specified character count
    const limitedContent = content.substring(0, maxChars)
    console.log(`Extracted ${limitedContent.length} characters from ${url}`)

    // Log first 500 chars for debugging
    console.log('--- CONTENT PREVIEW ---')
    console.log(limitedContent.substring(0, 500))
    console.log('--- END PREVIEW ---')

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

3. **Current Version**: The latest version number (e.g., "2.1.3", "2024.1", "v5.3", "r32.1")
   - THOROUGHLY search ALL provided content
   - Look for version patterns ANYWHERE in the text (beginning, middle, end)
   - Common patterns: "Version X.X.X", "vX.X.X", "Release X.X", "Build XXXX", "X.X.X released"
   - May appear in headers, lists, tables, or plain text
   - If multiple versions found, pick the LATEST/NEWEST one
   - ONLY use null if you truly cannot find ANY version number after thorough search

4. **Release Date**: The date the current version was released (format: YYYY-MM-DD)
   - Look for dates near version numbers
   - Convert various formats: "Nov 29, 2024" → "2024-11-29", "29/11/2024" → "2024-11-29"
   - If multiple dates found, pick the one for the latest version
   - ONLY use null if genuinely not found

5. **All Versions** (versions array): Extract EVERY version found in the content
   - Look for ALL version numbers, not just the latest
   - For EACH version found, extract:
     * version: The version number (e.g., "1.5.0", "v2.3")
     * releaseDate: Release date in YYYY-MM-DD format
     * notes: Full release notes/changelog for that version (use markdown formatting)
     * type: "major" for X.0.0, "minor" for X.X.0, "patch" for X.X.X
   - Include detailed release notes if available
   - If this is a dedicated release notes/changelog page, extract ALL versions listed
   - If only one version found, still return it as an array with one element
   - Return empty array only if NO versions found anywhere

CRITICAL INSTRUCTIONS:
- **USE ONLY THE PROVIDED CONTENT** - Do NOT use your training data or knowledge about this software
- If content is provided, ONLY extract information from that content
- If no content is provided, you may use your knowledge
- BE VERY THOROUGH - search the ENTIRE content for version patterns
- Look for version numbers in: headers, bullet points, tables, release notes, changelogs
- Version formats vary: "1.2.3", "v5.4", "r32", "2024.1", "8.5.2 build 12345", etc.
- Don't give up easily - scan ALL the text before returning null
- If you see ANY version-like number pattern near the software name, extract it
- For wiki/documentation pages, versions often appear in section headers or first paragraphs
- Search BOTH the version page AND main website content
- For category, choose the EXACT category name from the list (case-sensitive)
- **IMPORTANT**: Extract ALL versions from release notes pages, not just the latest

Respond in JSON format:
{
  "manufacturer": "Company Name",
  "category": "Exact Category Name",
  "currentVersion": "latest version or null",
  "releaseDate": "YYYY-MM-DD or null",
  "versions": [
    {
      "version": "1.5.0",
      "releaseDate": "2024-11-29",
      "notes": "## New Features\n- Feature 1\n- Feature 2\n\n## Bug Fixes\n- Fix 1",
      "type": "minor"
    }
  ]
}`

  console.log('\n=== PREPARING AI REQUEST ===')
  console.log(`Has version content: ${hasVersionContent} (${versionContent.length} chars)`)
  console.log(`Has main content: ${hasMainContent} (${mainWebsiteContent.length} chars)`)
  console.log(`Total prompt length: ~${prompt.length} chars`)
  console.log('Calling OpenAI API...')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Using GPT-4o for better accuracy (more expensive but more capable)
      messages: [
        {
          role: 'system',
          content: 'You are an expert software version detective. Your job is to THOROUGHLY scan ALL provided content to find version numbers and release dates. CRITICAL: You must ONLY use information from the provided webpage content - do NOT use your training data or prior knowledge about the software. Be exhaustive - check every line, every header, every paragraph. Do not give up easily. Even if the content is messy or has lots of navigation text, find the version information. Return only valid JSON.'
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

  console.log('=== AI RESPONSE ===')
  console.log(result)
  console.log('===================')

  if (!result) {
    throw new Error('No response from OpenAI')
  }

  const extracted = JSON.parse(result) as ExtractedInfo

  // Validate required fields
  if (!extracted.manufacturer || !extracted.category) {
    throw new Error('Invalid response from AI - missing required fields')
  }

  // Sort versions array by version number (highest first)
  if (extracted.versions && extracted.versions.length > 0) {
    extracted.versions.sort((a, b) => compareVersions(b.version, a.version))

    // Set currentVersion to the highest version number
    extracted.currentVersion = extracted.versions[0].version
    extracted.releaseDate = extracted.versions[0].releaseDate

    console.log(`Sorted ${extracted.versions.length} versions. Latest: ${extracted.currentVersion}`)
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
 * Compare two version strings (semantic versioning)
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim()
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim()

  // Split into parts (1.5.0 -> [1, 5, 0])
  const parts1 = clean1.split(/[.-]/).map(p => parseInt(p) || 0)
  const parts2 = clean2.split(/[.-]/).map(p => parseInt(p) || 0)

  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  return 0
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

    // Fetch content from both URLs in parallel (try regular fetch first)
    let [versionContent, mainWebsiteContent] = await Promise.all([
      fetchWebpageContent(versionUrl, 30000, false), // Regular fetch first
      // Only fetch main website if it's different from version URL
      versionUrl.toLowerCase() !== website.toLowerCase()
        ? fetchWebpageContent(website, 20000, false)
        : Promise.resolve('')
    ])

    console.log(`\n=== INITIAL CONTENT LENGTHS ===`)
    console.log(`Version content length: ${versionContent.length}`)
    console.log(`Main website content length: ${mainWebsiteContent.length}`)

    // Detect if this is likely a JavaScript-rendered page
    const isLikelyJavaScriptPage = versionContent.length < 2000
    const hasVeryLowContent = versionContent.length < 500

    if (isLikelyJavaScriptPage) {
      console.log(`⚠️ WARNING: Low content detected (${versionContent.length} chars) - likely JavaScript-rendered page`)
      console.log(`🔄 Retrying with Browserless (headless Chrome)...`)

      // Retry with Browserless for JavaScript pages
      versionContent = await fetchWebpageContent(versionUrl, 30000, true)

      console.log(`\n=== AFTER BROWSERLESS ===`)
      console.log(`Version content length: ${versionContent.length}`)

      if (versionContent.length > 2000) {
        console.log(`✅ SUCCESS: Browserless extracted much more content!`)
      }
    }

    // Log what we're actually sending to the AI
    console.log(`\n=== VERSION CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(versionContent.substring(0, 1000))
    console.log(`\n=== MAIN WEBSITE CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(mainWebsiteContent.substring(0, 1000))
    console.log(`\n=== END CONTENT PREVIEW ===`)

    // Re-check if still low content after Browserless
    const stillLowContent = versionContent.length < 2000

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

    // Add JavaScript page detection flag and warning (only if Browserless also failed)
    if (stillLowContent) {
      extracted.isJavaScriptPage = true
      extracted.lowContentWarning = `This page uses JavaScript rendering and couldn't be fully loaded (${versionContent.length} characters extracted). Please verify the version manually by visiting the page.`
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
