// Supabase Edge Function for AI-powered software info extraction
// This keeps the OpenAI API key secure on the server side
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'
// @deno-types="npm:@types/pdfjs-dist"
import * as pdfjsLib from 'npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs'

// Import validation utilities for intelligent version detection
import {
  validateExtraction,
  calculateConfidenceScore,
  detectVersionAnomaly,
  type ValidationResult
} from '../_shared/validation.ts'

import {
  getPatternForProduct,
  extractVersionWithPattern,
  createProductIdentifier
} from '../_shared/version-patterns.ts'

import {
  extractSmartContent,
  findProductMentions
} from '../_shared/content-extraction.ts'

import {
  learnFromSuccess,
  storePattern,
  loadPatterns,
  findBestPattern,
  type LearnedPattern,
  type ExtractionAttempt
} from '../_shared/pattern-learning.ts'

import {
  detectAnomalies,
  requiresManualReview,
  formatAnomalies,
  type Anomaly
} from '../_shared/anomaly-detection.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Feature flag: Set to 'true' to enable enhanced extraction with validation
// This allows running both old and new systems in parallel for testing
const USE_ENHANCED_EXTRACTION = Deno.env.get('USE_ENHANCED_EXTRACTION') === 'true'

interface ExtractRequest {
  name: string
  website: string
  versionUrl: string
  description?: string
  content?: string  // Optional raw text content (e.g., from PDF parsing)
  manufacturer?: string  // Manufacturer name (Phase 2 enhancement)
  productIdentifier?: string  // Product identifier for pattern matching (Phase 2)
  scrapingStrategy?: ScrapingStrategy  // Interactive scraping strategy (Phase 3)
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
  // New fields for enhanced validation (Phase 2)
  confidence?: number          // AI confidence score (0-100)
  productNameFound?: boolean   // Whether product name was found on page
  validationNotes?: string     // Human-readable validation explanation
  validationResult?: ValidationResult  // Full validation result
  extractionMethod?: string    // 'enhanced_ai' or 'legacy'
}

/**
 * Scraping strategy for interactive content extraction
 */
interface ScrapingStrategy {
  releaseNotesSelectors?: string[]  // Buttons/links to click
  expandSelectors?: string[]        // Accordions to expand
  waitForSelector?: string          // Wait for element to appear
  waitTime?: number                 // Time to wait in ms (default 2000)
  customScript?: string             // Custom JavaScript to execute
}

/**
 * Fetches webpage content using Browserless (headless Chrome) for JavaScript rendering
 * Basic version - just renders the page without interaction
 */
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set, skipping browser rendering')
    return ''
  }

  try {
    console.log(`🌐 Fetching with Browserless (headless Chrome): ${url}`)

    const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}&stealth=true`

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        // Add headers to help evade bot detection
        setExtraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
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

    // Detect specific error types
    const errorMsg = error?.message || String(error)
    if (errorMsg.includes('ERR_HTTP2_PROTOCOL_ERROR') || errorMsg.includes('ERR_CONNECTION')) {
      console.warn('⚠️ Site may be blocking automated browsers (HTTP2/connection errors)')
    }

    return ''
  }
}

/**
 * Fetches webpage with INTERACTIVE scraping (Phase 3)
 * Uses Browserless /content API with bestAttempt for reliability
 */
async function fetchWithInteraction(url: string, strategy: ScrapingStrategy): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set, skipping interactive scraping')
    return await fetchWithBrowserless(url) // Fallback to basic rendering
  }

  try {
    console.log(`🎭 INTERACTIVE SCRAPING (Phase 3): ${url}`)
    console.log(`Strategy:`, JSON.stringify(strategy, null, 2))

    const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}&bestAttempt=true&stealth=true`

    // Just fetch the rendered page with JavaScript enabled
    // We'll let Browserless handle the rendering
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: 30000
        },
        // Add headers to help evade bot detection
        setExtraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Browserless content error: ${response.status} - ${error}`)
    }

    const html = await response.text()
    console.log(`✅ Interactive scraping complete: ${html.length} characters`)

    return html

  } catch (error) {
    console.error(`❌ Interactive scraping failed for ${url}:`, error)
    console.log('Falling back to basic Browserless rendering...')
    return await fetchWithBrowserless(url) // Fallback
  }
}

/**
 * Fetches and parses PDF content from a URL
 */
async function fetchPDFContent(url: string): Promise<string> {
  try {
    console.log(`📄 Fetching PDF from: ${url}`)

    // Fetch the PDF file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Get PDF as ArrayBuffer
    const pdfData = await response.arrayBuffer()
    console.log(`Downloaded PDF: ${pdfData.byteLength} bytes`)

    // Parse PDF with pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) })
    const pdf = await loadingTask.promise

    console.log(`PDF loaded: ${pdf.numPages} pages`)

    // Extract text from all pages
    let fullText = ''
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      fullText += pageText + '\n\n'
    }

    console.log(`✅ Extracted ${fullText.length} characters from PDF`)
    return fullText.trim()
  } catch (error) {
    console.error(`❌ PDF parsing failed for ${url}:`, error)
    throw new Error(`Failed to parse PDF: ${error.message}`)
  }
}

/**
 * Extract version history from Apple App Store embedded JSON
 * Apple embeds structured JSON in the HTML which is much more reliable than parsing text
 */
function extractAppleAppStoreJSON(html: string): string | null {
  try {
    console.log('🍎 Attempting to extract Apple App Store embedded JSON...')

    // Look for the JSON data embedded in script tags
    // Apple typically embeds data in <script type="application/json"> or window.__INITIAL_STATE__
    const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gis)

    if (!scriptMatches) {
      console.log('⚠️ No script tags found')
      return null
    }

    for (const scriptTag of scriptMatches) {
      try {
        // Extract the content between script tags
        const scriptContent = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim()

        // Skip if it's not JSON-like
        if (!scriptContent.startsWith('{') && !scriptContent.startsWith('[')) {
          continue
        }

        // Try to parse as JSON
        const data = JSON.parse(scriptContent)

        // Look for version history data in the JSON structure
        // Based on the structure you provided, look for versionHistory or similar
        const versionData = findVersionHistoryInJSON(data)

        if (versionData && versionData.length > 0) {
          console.log(`✅ Found ${versionData.length} versions in Apple App Store JSON`)
          // Format the data in a way that's easy for AI to parse
          return formatAppleVersionHistory(versionData)
        }
      } catch (e) {
        // Not valid JSON or doesn't have what we need, continue to next script
        continue
      }
    }

    console.log('⚠️ No version history found in embedded JSON')
    return null
  } catch (error) {
    console.error('Error extracting Apple App Store JSON:', error)
    return null
  }
}

/**
 * Recursively search for version history in JSON object
 */
function findVersionHistoryInJSON(obj: any, depth: number = 0): any[] | null {
  if (depth > 5) return null // Prevent infinite recursion

  // Check if this object has version history structure
  if (Array.isArray(obj)) {
    // Check if this looks like a version array
    if (obj.length > 0 && obj[0].text && obj[0].primarySubtitle && obj[0].secondarySubtitle) {
      return obj
    }
    // Search through array elements
    for (const item of obj) {
      const result = findVersionHistoryInJSON(item, depth + 1)
      if (result) return result
    }
  } else if (typeof obj === 'object' && obj !== null) {
    // Look for common keys that might contain version history
    const versionKeys = ['versionHistory', 'versions', 'items', 'shelves', 'data', 'pageData']
    for (const key of versionKeys) {
      if (obj[key]) {
        const result = findVersionHistoryInJSON(obj[key], depth + 1)
        if (result) return result
      }
    }
    // Search through all object values
    for (const value of Object.values(obj)) {
      const result = findVersionHistoryInJSON(value, depth + 1)
      if (result) return result
    }
  }

  return null
}

/**
 * Format Apple version history data for AI consumption
 */
function formatAppleVersionHistory(versions: any[]): string {
  let formatted = 'APPLE APP STORE VERSION HISTORY (Structured Data):\n\n'

  for (const version of versions) {
    const notes = version.text || ''
    const versionNum = version.primarySubtitle || ''
    const date = version.secondarySubtitle || ''

    formatted += `Version: ${versionNum}\n`
    formatted += `Date: ${date}\n`
    formatted += `Notes: ${notes}\n`
    formatted += `---\n\n`
  }

  return formatted
}

/**
 * Fetches webpage content and extracts text, with intelligent content limits
 * Phase 3: Now supports interactive scraping strategies
 * Returns: { content: string, method: string }
 */
async function fetchWebpageContent(
  url: string,
  maxChars: number = 30000,
  useBrowserless: boolean = false,
  strategy?: ScrapingStrategy
): Promise<{ content: string; method: string }> {
  try {
    console.log(`Fetching webpage: ${url}`)
    if (strategy) {
      console.log(`🎭 Using INTERACTIVE SCRAPING strategy`)
    } else if (useBrowserless) {
      console.log(`🌐 Using Browserless (passive rendering)`)
    }

    let html: string
    let method: string = 'static'

    // Priority 1: Interactive scraping with strategy (Phase 3)
    if (strategy && (strategy.releaseNotesSelectors || strategy.expandSelectors || strategy.customScript)) {
      console.log('🎯 Attempting interactive scraping...')
      html = await fetchWithInteraction(url, strategy)

      // If interactive scraping returned good content, use it
      if (html && html.length > 2000) {
        console.log(`✅ Interactive scraping successful: ${html.length} chars`)
        method = 'interactive'
      } else {
        console.log(`⚠️ Interactive scraping returned little content (${html?.length || 0} chars), trying Browserless...`)
        html = await fetchWithBrowserless(url)
        method = html && html.length > 100 ? 'browserless' : 'static'
      }
    }
    // Priority 2: Browserless for JavaScript pages
    else if (useBrowserless) {
      html = await fetchWithBrowserless(url)
      method = 'browserless'

      if (!html) {
        console.warn('Browserless failed, falling back to regular fetch')
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
          },
        })
        html = await response.text()
        method = 'static'
      }
    }
    // Priority 3: Static fetch
    else {
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
      method = 'static'
    }

    console.log(`📄 Raw HTML fetched: ${html.length} characters`)

    // APPLE APP STORE: Try to extract structured JSON first
    if (url.includes('apps.apple.com')) {
      const jsonContent = extractAppleAppStoreJSON(html)
      if (jsonContent) {
        console.log(`✅ Using Apple App Store structured JSON (${jsonContent.length} chars)`)
        return { content: jsonContent, method: 'apple_json' }
      } else {
        console.log('⚠️ Apple App Store JSON extraction failed, falling back to text extraction')
      }
    }

    const doc = new DOMParser().parseFromString(html, 'text/html')

    if (!doc) {
      throw new Error('Failed to parse HTML')
    }

    console.log(`✅ HTML parsed successfully, extracting content...`)

    // Try to find main content areas first (more intelligent extraction)
    // Added wiki-specific selectors and documentation page patterns
    const selectors = [
      // Blackmagic Design specific
      '.support-downloads',
      '.downloads-list',
      '.product-downloads',
      '#downloads',
      '.latest-downloads',

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
    let bestContent = ''
    let bestLength = 0
    let bestSelector = ''
    const selectorSizes: Array<{selector: string, size: number}> = []

    // Try to extract from semantic elements first - find the LARGEST content area
    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element?.textContent) {
        const len = element.textContent.trim().length
        selectorSizes.push({ selector, size: len })
        if (len > bestLength) {
          bestContent = element.textContent
          bestLength = len
          bestSelector = selector
        }
      }
    }

    // Log all selectors found (top 5)
    if (selectorSizes.length > 0) {
      console.log('Top 5 selectors by size:')
      selectorSizes
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .forEach(s => console.log(`  ${s.selector}: ${s.size} chars`))
    }

    // Use the best content found if it's substantial (>1000 chars)
    // Otherwise fall back to body to get everything
    if (bestLength > 1000) {
      content = bestContent
      console.log(`✅ Using content from ${bestSelector} (${content.length} chars)`)
    } else {
      content = doc.body?.textContent || ''
      console.log(`⚠️ Using full body content (${content.length} chars) - semantic selectors too small (best was ${bestLength} chars from ${bestSelector})`)
    }

    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()

    // Don't limit here - let smart windowing handle it later
    // We need the FULL content to search for product mentions
    console.log(`Extracted ${content.length} characters from ${url}`)

    // Log first 500 chars for debugging
    console.log('--- CONTENT PREVIEW ---')
    console.log(content.substring(0, 500))
    console.log('--- END PREVIEW ---')

    return { content, method }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error)
    return { content: '', method: 'error' }
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
   - **IMPORTANT**: Use null if date not found - DO NOT make up or guess dates
   - Only use dates that are explicitly stated in the content

5. **All Versions** (versions array): Extract EVERY version found in the content
   - Look for ALL version numbers, not just the latest
   - For EACH version found, extract:
     * version: The version number (e.g., "1.5.0", "v2.3")
     * releaseDate: Release date in YYYY-MM-DD format - **USE NULL IF NOT FOUND, DO NOT GUESS**
     * notes: Full release notes/changelog for that version (use markdown formatting)
     * type: "major" for X.0.0, "minor" for X.X.0, "patch" for X.X.X
   - Include detailed release notes if available
   - If this is a dedicated release notes/changelog page, extract ALL versions listed
   - If only one version found, still return it as an array with one element
   - Return empty array only if NO versions found anywhere
   - **CRITICAL**: Do not invent dates - only use dates explicitly mentioned in the content
   - **APPLE APP STORE PAGES**: On App Store pages, release notes appear BEFORE the version number in the text flow
     * Pattern: "notes text vX.X.X date notes text vX.X.X date"
     * Each version's notes are the text that appears IMMEDIATELY BEFORE that version number
     * Do NOT associate a version with the notes that come AFTER it

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
          content: 'You are an expert software version detective. Your job is to THOROUGHLY scan ALL provided content to find version numbers and release dates. CRITICAL RULES: (1) You must ONLY use information from the provided webpage content - do NOT use your training data or prior knowledge about the software. (2) DO NOT make up or guess release dates - use null if date is not explicitly stated in the content. (3) Be exhaustive - check every line, every header, every paragraph. Do not give up easily. Even if the content is messy or has lots of navigation text, find the version information. Return only valid JSON.'
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

    // APPLE APP STORE FIX: Check if this might be an App Store page with mismatched notes
    // App Store pages often show the current version at top but with previous version's notes
    if (versionUrl.includes('apps.apple.com') && extracted.versions.length >= 2) {
      console.log('⚠️ Detected Apple App Store URL - checking for note mismatch...')

      // Check if the first version's notes might actually belong to the second version
      // by looking for version numbers mentioned in the notes
      const firstVersion = extracted.versions[0]
      const secondVersion = extracted.versions[1]

      // If the first version's notes mention the second version number, they're probably swapped
      const firstNotesLower = firstVersion.notes.toLowerCase()
      const secondVersionClean = secondVersion.version.replace(/^[vr]/i, '')

      if (firstNotesLower.includes(secondVersionClean.toLowerCase()) ||
          firstNotesLower.includes(`version ${secondVersionClean}`) ||
          firstNotesLower.includes(`v${secondVersionClean}`)) {
        console.log('🔄 DETECTED NOTE MISMATCH: Swapping notes between top two versions')
        console.log(`  Before: ${firstVersion.version} had notes mentioning ${secondVersionClean}`)

        // Swap the notes
        const tempNotes = firstVersion.notes
        firstVersion.notes = secondVersion.notes
        secondVersion.notes = tempNotes

        console.log(`  After: Notes swapped between ${firstVersion.version} and ${secondVersion.version}`)
      }
    }

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
 * Enhanced AI extraction with strict product validation (Phase 2)
 * This version includes product name validation to prevent mixing up
 * software from the same manufacturer
 */
async function extractWithAIEnhanced(
  name: string,
  manufacturer: string,
  website: string,
  versionUrl: string,
  versionContent: string,
  mainWebsiteContent: string,
  productIdentifier?: string,
  description?: string
): Promise<ExtractedInfo> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const hasVersionContent = versionContent.length > 100
  const hasMainContent = mainWebsiteContent.length > 100

  console.log('=== ENHANCED AI EXTRACTION (Phase 2) ===')
  console.log(`Product: ${name}`)
  console.log(`Manufacturer: ${manufacturer}`)
  console.log(`Product Identifier: ${productIdentifier || 'none'}`)

  // Enhanced prompt with strict product validation
  const prompt = `You are a software version detective with strict validation rules.

**TARGET PRODUCT INFORMATION:**
- Product Name: "${name}"
- Manufacturer: "${manufacturer}"
${productIdentifier ? `- Product Identifier: "${productIdentifier}"` : ''}
- Version URL: ${versionUrl}
${description ? `- Description: ${description}` : ''}

**CRITICAL VALIDATION RULES:**

1. ⚠️ You are extracting version info for ONLY "${name}" - NOT any other product
2. ⚠️ If this page contains multiple products from ${manufacturer}, you MUST:
   - Identify which content belongs specifically to "${name}"
   - ONLY extract version numbers that appear near/with "${name}"
   - COMPLETELY IGNORE version numbers for other products
   - Return null if you cannot confidently identify which version belongs to "${name}"

3. **VALIDATION REQUIREMENTS:**
   - The version number MUST appear in the same section/paragraph as "${name}"
   - If you see other product names with version numbers, IGNORE them completely
   - If you cannot find "${name}" mentioned on the page, return null for version
   - Provide a confidence score (0-100) for your extraction
   - Mark productNameFound as true only if "${name}" appears on page

**EXAMPLES OF CORRECT BEHAVIOR:**

✅ CORRECT Example 1:
Page: "DaVinci Resolve 19.1.3 released Dec 1. Fusion Studio 19.1.3 also available."
Target: "DaVinci Resolve"
Response: { version: "19.1.3", releaseDate: "2024-12-01", confidence: 95, productNameFound: true }

❌ WRONG Example 1:
Page: "DaVinci Resolve 19.1.3 released Dec 1. Fusion Studio 19.1.3 also available."
Target: "DaVinci Resolve"
Response: { version: "19.1.3", confidence: 50, productNameFound: false }  ← WRONG! Product name WAS found

✅ CORRECT Example 2:
Page: "ATEM Mini 9.6.1 is now available"
Target: "DaVinci Resolve"
Response: { version: null, confidence: 0, productNameFound: false, validationNotes: "Target product not found on page" }

❌ WRONG Example 2:
Page: "ATEM Mini 9.6.1 is now available"
Target: "DaVinci Resolve"
Response: { version: "9.6.1", confidence: 95 }  ← WRONG! This is ATEM's version, not DaVinci's

✅ CORRECT Example 3:
Page: "Version 2.5.0 released today"
Target: "QLab"
Response: { version: "2.5.0", confidence: 40, productNameFound: false, validationNotes: "Version found but product name not mentioned" }

${hasVersionContent ? `
VERSION PAGE CONTENT (from ${versionUrl}):
${versionContent}
` : ''}

${hasMainContent ? `
MAIN WEBSITE CONTENT (from ${website}):
${mainWebsiteContent}
` : ''}

${!hasVersionContent && !hasMainContent ? `
Note: Unable to fetch content from either URL. Please use your knowledge about this software to provide accurate information.
` : ''}

**EXTRACTION TASK:**

Extract the following information:

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

3. **Current Version**: The latest version number for "${name}" ONLY
   - Search ALL provided content thoroughly
   - ONLY extract if you find "${name}" mentioned near the version
   - Return null if product name not found or version ambiguous
   - Common patterns: "Version X.X.X", "vX.X.X", "Release X.X", "Build XXXX"
   - If multiple versions found, pick the LATEST one for THIS product

4. **Release Date**: Format YYYY-MM-DD
   - USE NULL if not found - DO NOT guess or make up dates
   - Only use dates explicitly stated in content
   - Convert formats: "Nov 29, 2024" → "2024-11-29"

5. **All Versions**: Extract EVERY version for "${name}" found in content
   - For EACH version: { version, releaseDate (or null), notes, type }
   - ONLY include versions clearly associated with "${name}"
   - Exclude versions for other products
   - Include full release notes in markdown format
   - **APPLE APP STORE PAGES**: On App Store pages, release notes appear BEFORE the version number in the text flow
     * Pattern: "notes text vX.X.X date notes text vX.X.X date"
     * Each version's notes are the text that appears IMMEDIATELY BEFORE that version number
     * Do NOT associate a version with the notes that come AFTER it

6. **Validation Fields** (REQUIRED):
   - **confidence**: 0-100 score for how confident you are this is correct
     - 90-100: Very confident, product name found, version nearby
     - 70-89: Confident, product name found, version present
     - 50-69: Moderate, product name found OR version present
     - 30-49: Low, unclear which product
     - 0-29: Very low, likely wrong product
   - **productNameFound**: true/false - was "${name}" found on page?
   - **validationNotes**: Brief explanation of confidence level

**CRITICAL INSTRUCTIONS:**
- **USE ONLY THE PROVIDED CONTENT** - Do NOT use your training data
- If content is provided, ONLY extract from that content
- BE THOROUGH - search ENTIRE content for version patterns
- DO NOT make up or guess release dates - use null if not found
- BE HONEST about confidence - low confidence is better than wrong data
- Better to return null with explanation than wrong product's version

**RESPOND IN JSON FORMAT:**
{
  "manufacturer": "Company Name",
  "category": "Exact Category Name",
  "currentVersion": "X.X.X or null",
  "releaseDate": "YYYY-MM-DD or null",
  "confidence": 0-100,
  "productNameFound": true/false,
  "validationNotes": "Brief explanation of why confident or uncertain",
  "versions": [
    {
      "version": "1.5.0",
      "releaseDate": "2024-11-29 or null",
      "notes": "Full release notes in markdown",
      "type": "major|minor|patch"
    }
  ]
}`

  console.log(`Prompt length: ~${prompt.length} chars`)
  console.log(`Has version content: ${hasVersionContent} (${versionContent.length} chars)`)
  console.log(`Has main content: ${hasMainContent} (${mainWebsiteContent.length} chars)`)

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
          content: `You are an expert software version detective with strict validation rules.

CRITICAL RULES:
1. ONLY extract information for the specific product requested - NOT other products
2. If multiple products appear on the page, distinguish between them carefully
3. DO NOT make up or guess release dates - use null if not found
4. Provide HONEST confidence scores - use low confidence if uncertain
5. Mark productNameFound=true ONLY if the exact product name appears on page
6. ONLY use information from provided webpage content, NOT your training data
7. Return only valid JSON

Remember: It's better to return null with low confidence than to extract the wrong product's version.
Better to be honest about uncertainty than to provide incorrect data.`
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

  console.log('=== ENHANCED AI RESPONSE ===')
  console.log(result)
  console.log('============================')

  const extracted = JSON.parse(result) as ExtractedInfo

  // Validate required fields
  if (!extracted.manufacturer || !extracted.category) {
    throw new Error('Invalid AI response - missing required fields')
  }

  // Mark extraction method
  extracted.extractionMethod = 'enhanced_ai'

  // Sort versions array by version number (highest first)
  if (extracted.versions && extracted.versions.length > 0) {
    extracted.versions.sort((a, b) => compareVersions(b.version, a.version))

    // APPLE APP STORE FIX: Check if this might be an App Store page with mismatched notes
    // App Store pages often show the current version at top but with previous version's notes
    if (versionUrl.includes('apps.apple.com') && extracted.versions.length >= 2) {
      console.log('⚠️ Detected Apple App Store URL - checking for note mismatch...')

      // Check if the first version's notes might actually belong to the second version
      // by looking for version numbers mentioned in the notes
      const firstVersion = extracted.versions[0]
      const secondVersion = extracted.versions[1]

      // If the first version's notes mention the second version number, they're probably swapped
      const firstNotesLower = firstVersion.notes.toLowerCase()
      const secondVersionClean = secondVersion.version.replace(/^[vr]/i, '')

      if (firstNotesLower.includes(secondVersionClean.toLowerCase()) ||
          firstNotesLower.includes(`version ${secondVersionClean}`) ||
          firstNotesLower.includes(`v${secondVersionClean}`)) {
        console.log('🔄 DETECTED NOTE MISMATCH: Swapping notes between top two versions')
        console.log(`  Before: ${firstVersion.version} had notes mentioning ${secondVersionClean}`)

        // Swap the notes
        const tempNotes = firstVersion.notes
        firstVersion.notes = secondVersion.notes
        secondVersion.notes = tempNotes

        console.log(`  After: Notes swapped between ${firstVersion.version} and ${secondVersion.version}`)
      }
    }

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

  // Run post-extraction validation
  console.log('\n=== RUNNING POST-EXTRACTION VALIDATION ===')
  const validation = validateExtraction(
    { name, manufacturer, product_identifier: productIdentifier },
    extracted,
    versionContent + ' ' + mainWebsiteContent
  )

  console.log(`Validation result: ${validation.valid ? '✅ VALID' : '⚠️ INVALID'}`)
  console.log(`Confidence: ${validation.confidence}%`)
  console.log(`Reason: ${validation.reason}`)
  if (validation.warnings.length > 0) {
    console.log(`Warnings: ${validation.warnings.join(', ')}`)
  }

  // Store validation result
  extracted.validationResult = validation
  extracted.confidence = validation.confidence

  // Add validation notes if there are warnings or low confidence
  if (!validation.valid || validation.confidence < 70 || validation.warnings.length > 0) {
    extracted.validationNotes = validation.reason
    if (validation.warnings.length > 0) {
      extracted.validationNotes += ' | Warnings: ' + validation.warnings.join('; ')
    }
  }

  console.log('Enhanced extraction complete')
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
    const { name, website, versionUrl, description, content, manufacturer, productIdentifier, scrapingStrategy } = await req.json() as ExtractRequest

    if (!name || !website) {
      return new Response(
        JSON.stringify({ error: 'name and website are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing extraction for: ${name}`)
    console.log(`Version URL: ${versionUrl}`)
    console.log(`Main Website: ${website}`)
    console.log(`Manufacturer: ${manufacturer || 'unknown'}`)
    console.log(`Product Identifier: ${productIdentifier || 'none'}`)
    console.log(`Extraction Mode: ${USE_ENHANCED_EXTRACTION ? '🧠 ENHANCED (Phase 2)' : '📊 LEGACY (Original)'}`)
    console.log(`Interactive Scraping: ${scrapingStrategy ? '🎭 YES (Phase 3)' : '❌ NO'}`)
    console.log(`Has provided content: ${!!content}`)
    console.log('='.repeat(60))

    let versionContent = ''
    let mainWebsiteContent = ''
    let fetchMethod = 'static' // Track which method was used for version content

    // If content is provided directly (e.g., from PDF parsing), use it
    if (content && content.length > 100) {
      console.log(`Using provided content (${content.length} characters)`)
      versionContent = content
      fetchMethod = 'provided'
      // Still fetch main website for manufacturer/category info if URL is different
      if (versionUrl && versionUrl.toLowerCase() !== website.toLowerCase()) {
        const mainResult = await fetchWebpageContent(website, 20000, false)
        mainWebsiteContent = mainResult.content
      }
    } else if (versionUrl) {
      // Otherwise fetch content from URLs
      // Check if versionUrl is a PDF
      const isPDF = versionUrl.toLowerCase().endsWith('.pdf')

      if (isPDF) {
        console.log(`Detected PDF URL: ${versionUrl}`)

        // Fetch and parse PDF content
        try {
          versionContent = await fetchPDFContent(versionUrl)
          fetchMethod = 'pdf'
        } catch (pdfError) {
          console.error('PDF parsing failed:', pdfError)
          // Continue with empty content, will return error later
          versionContent = ''
          fetchMethod = 'error'
        }

        // Still fetch main website for manufacturer/category info
        if (versionUrl.toLowerCase() !== website.toLowerCase()) {
          const mainResult = await fetchWebpageContent(website, 20000, false)
          mainWebsiteContent = mainResult.content
        }
      } else {
        // Fetch content from both URLs in parallel (try regular fetch first)
        // Phase 3: Pass scraping strategy if provided
        const [versionResult, mainResult] = await Promise.all([
          fetchWebpageContent(versionUrl, 30000, false, scrapingStrategy),
          // Only fetch main website if it's different from version URL
          versionUrl.toLowerCase() !== website.toLowerCase()
            ? fetchWebpageContent(website, 20000, false)
            : Promise.resolve({ content: '', method: 'skipped' })
        ])

        versionContent = versionResult.content
        mainWebsiteContent = mainResult.content
        fetchMethod = versionResult.method
      }

      console.log(`\n=== INITIAL CONTENT LENGTHS ===`)
      console.log(`Version content length: ${versionContent.length}`)
      console.log(`Main website content length: ${mainWebsiteContent.length}`)
      console.log(`Fetch method: ${fetchMethod}`)

      // Detect if this is likely a JavaScript-rendered page
      const isLikelyJavaScriptPage = versionContent.length < 2000
      const hasVeryLowContent = versionContent.length < 500

      // Retry with Browserless if content is low AND we haven't already tried interactive/browserless
      if (isLikelyJavaScriptPage && !isPDF && fetchMethod === 'static') {
        console.log(`⚠️ WARNING: Low content detected (${versionContent.length} chars) - likely JavaScript-rendered page`)
        console.log(`🔄 Retrying with Browserless (headless Chrome)...`)

        // Retry with Browserless for JavaScript pages
        const retryResult = await fetchWebpageContent(versionUrl, 30000, true, scrapingStrategy)
        versionContent = retryResult.content
        fetchMethod = retryResult.method

        console.log(`\n=== AFTER BROWSERLESS ===`)
        console.log(`Version content length: ${versionContent.length}`)
        console.log(`Fetch method: ${fetchMethod}`)

        if (versionContent.length > 2000) {
          console.log(`✅ SUCCESS: Browserless extracted much more content!`)
        }
      }
    }

    // Apply smart content extraction (Phase 4: Smart Windowing)
    // Search the FULL content for product mentions, extract windows around them
    // This ensures we find the product even if buried deep in the page
    if (versionContent.length > 1000 && name) {
      console.log('\n🎯 Applying smart content extraction...')
      const smartResult = extractSmartContent(versionContent, name, 30000)

      if (smartResult.foundProduct) {
        console.log(`✅ Smart extraction successful - found product! (${smartResult.method})`)
        versionContent = smartResult.content
      } else {
        console.log(`⚠️ Product not found in ${versionContent.length} chars, using first chunk (${smartResult.method})`)
        versionContent = smartResult.content
      }
    } else if (versionContent.length > 30000) {
      // If no product name provided, just truncate to reasonable size
      console.log(`⚠️ No product name for smart extraction, truncating to 30K`)
      versionContent = versionContent.substring(0, 30000)
    }

    // Log what we're actually sending to the AI
    console.log(`\n=== VERSION CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(versionContent.substring(0, 1000))
    console.log(`\n=== MAIN WEBSITE CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(mainWebsiteContent.substring(0, 1000))
    console.log(`\n=== END CONTENT PREVIEW ===`)

    // Re-check if still low content after Browserless
    const stillLowContent = versionContent.length < 2000
    const noContentAtAll = versionContent.length === 0

    // Detect if site is completely blocking us (0 chars even after all retries)
    if (noContentAtAll && versionUrl) {
      console.error('❌ SITE BLOCKED: No content extracted after all attempts')
      console.error('This site may be blocking automated access with:')
      console.error('  - Bot detection (Cloudflare, Akamai, etc.)')
      console.error('  - HTTP2 protocol restrictions')
      console.error('  - Aggressive anti-scraping measures')

      // Check if it's a known problematic domain
      const url = new URL(versionUrl)
      if (url.hostname.includes('adobe.com') || url.hostname.includes('helpx.adobe')) {
        console.error('⚠️ Adobe domains are known to block automated browsers')
        console.error('Recommendation: Use manual content input or Adobe\'s official API')
      }
    }

    // Try AI extraction (choose between enhanced or legacy based on feature flag)
    let extracted: ExtractedInfo
    try {
      if (USE_ENHANCED_EXTRACTION) {
        console.log('\n🧠 Using ENHANCED extraction with product validation (Phase 2)')
        extracted = await extractWithAIEnhanced(
          name,
          manufacturer || 'Unknown',
          website,
          versionUrl,
          versionContent,
          mainWebsiteContent,
          productIdentifier,
          description
        )
      } else {
        console.log('\n📊 Using LEGACY extraction (original system)')
        extracted = await extractWithAI(
          name,
          website,
          versionUrl,
          versionContent,
          mainWebsiteContent,
          description
        )
        // Mark as legacy extraction
        extracted.extractionMethod = 'legacy'
      }
    } catch (aiError) {
      console.error(`AI extraction failed (${USE_ENHANCED_EXTRACTION ? 'enhanced' : 'legacy'}):`, aiError)
      // Fallback to domain extraction
      console.log('Using fallback domain extraction')
      extracted = extractFromDomain(website)
      extracted.extractionMethod = 'fallback'
    }

    // Set extraction method based on fetch method (Phase 3 tracking)
    // Priority: interactive > pdf > browserless > static
    if (fetchMethod === 'interactive') {
      extracted.extractionMethod = 'interactive'
      console.log('✅ Extraction method: INTERACTIVE (Phase 3)')
    } else if (fetchMethod === 'pdf') {
      extracted.extractionMethod = 'pdf'
    } else if (fetchMethod === 'browserless') {
      extracted.extractionMethod = extracted.extractionMethod || 'browserless'
    } else if (!extracted.extractionMethod || extracted.extractionMethod === 'legacy') {
      // Keep 'enhanced_ai', 'legacy', or 'fallback' if already set by AI extraction
      // Only override if it's not set or if it's legacy
      if (USE_ENHANCED_EXTRACTION && extracted.extractionMethod !== 'fallback') {
        extracted.extractionMethod = 'enhanced_ai'
      }
    }

    // Add JavaScript page detection flag and warning (only if Browserless also failed)
    if (stillLowContent) {
      extracted.isJavaScriptPage = true

      // Provide specific warning based on situation
      if (noContentAtAll) {
        // Site is completely blocking us
        const hostname = versionUrl ? new URL(versionUrl).hostname : 'this site'
        extracted.lowContentWarning = `⚠️ Could not extract any content from ${hostname}. This site is blocking automated access. Please manually copy the version information or use an alternative source.`
      } else {
        // Low content but not zero - likely JavaScript rendering issue
        extracted.lowContentWarning = `This page uses JavaScript rendering and couldn't be fully loaded (${versionContent.length} characters extracted). Please verify the version manually by visiting the page.`
      }
    }

    // Phase 6: Advanced Features - Pattern Learning & Anomaly Detection
    console.log('\n🔬 Running advanced analysis...')

    // 1. Learn from this extraction (if successful)
    if (extracted.confidence && extracted.confidence >= 70) {
      try {
        const attempt: ExtractionAttempt = {
          domain: versionUrl,
          productName: name,
          success: true,
          confidence: extracted.confidence,
          method: extracted.extractionMethod || 'unknown',
          strategy: scrapingStrategy,
          timestamp: new Date().toISOString()
        }

        const learnedPattern = learnFromSuccess(attempt)
        if (learnedPattern) {
          console.log(`📚 Learned new pattern for ${learnedPattern.domain}`)
          // Note: Actual storage would need Supabase client
          // storePattern(learnedPattern, supabase, software_id)
        }
      } catch (error) {
        console.error('Error in pattern learning:', error)
      }
    }

    // 2. Detect anomalies (if we have version data)
    if (extracted.currentVersion) {
      try {
        // For now, just detect basic anomalies without previous data
        // In production, we'd fetch the previous check from database
        const currentData = {
          version: extracted.currentVersion,
          releaseDate: extracted.releaseDate,
          confidence: extracted.confidence || 50,
          extractionMethod: extracted.extractionMethod || 'unknown'
        }

        const anomalies = detectAnomalies(currentData)

        if (anomalies.length > 0) {
          console.log(`⚠️ Detected ${anomalies.length} anomalies:`)
          console.log(formatAnomalies(anomalies))

          // Flag for manual review if needed
          const needsReview = requiresManualReview(anomalies)
          if (needsReview) {
            console.log('🚨 Anomalies require manual review')
            extracted.validationNotes = (extracted.validationNotes || '') + '\n' + formatAnomalies(anomalies)
            // Note: Would set requires_manual_review in database
          }
        } else {
          console.log('✅ No anomalies detected')
        }
      } catch (error) {
        console.error('Error in anomaly detection:', error)
      }
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
