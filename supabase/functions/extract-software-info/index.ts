// Supabase Edge Function for AI-powered software info extraction
// This keeps the OpenAI API key secure on the server side
// Updated: 2024-12-17 - Fixed isPDF reference, added RSS/forum support
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'
// @deno-types="npm:@types/pdfjs-dist"
import * as pdfjsLib from 'npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs'

// Import validation utilities for intelligent version detection
import {
  validateExtraction,
  calculateConfidenceScore,
  detectVersionAnomaly,
  isOfficialRepoFile,
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

import {
  fetchWithRetry,
  type FetchResult
} from '../_shared/fetch-with-retry.ts'

import {
  detectBotBlocker,
  logBotBlocking,
  type BlockerDetection
} from '../_shared/bot-blocker-handler.ts'

import {
  fetchWithInteraction,
  generatePuppeteerScript,
  type ScrapingStrategy
} from '../_shared/interactive-scraping.ts'

import {
  fetchRSSContent
} from '../_shared/rss-parser.ts'

import {
  fetchForumContent,
  type ForumConfig
} from '../_shared/forum-parser.ts'

import {
  discoverReleaseUrls,
  type SitemapUrl
} from '../_shared/sitemap-parser.ts'

import {
  getAIConfig,
  type AIConfig
} from '../_shared/ai-utils.ts'

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
  sourceType?: 'webpage' | 'rss' | 'forum' | 'pdf'  // Source type for content extraction
  forumConfig?: ForumConfig  // Forum configuration for forum source type
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
 * Returns the LONGEST array of versions found (to prefer full version history over "What's New")
 */
function findVersionHistoryInJSON(obj: any, depth: number = 0): any[] | null {
  if (depth > 10) return null // Prevent infinite recursion

  const allVersionArrays: any[][] = []

  function search(o: any, d: number) {
    if (d > 10) return

    // Check if this object has version history structure
    if (Array.isArray(o)) {
      // Check if this looks like a version array
      if (o.length > 0 && o[0].text && o[0].primarySubtitle && o[0].secondarySubtitle) {
        allVersionArrays.push(o)
      }
      // Continue searching through array elements
      for (const item of o) {
        search(item, d + 1)
      }
    } else if (typeof o === 'object' && o !== null) {
      // Search through all object values
      for (const value of Object.values(o)) {
        search(value, d + 1)
      }
    }
  }

  search(obj, depth)

  // Return the longest version array (full version history, not just "What's New")
  if (allVersionArrays.length === 0) {
    return null
  }

  const longest = allVersionArrays.reduce((longest, current) => {
    return current.length > longest.length ? current : longest
  })

  console.log(`📊 Found ${allVersionArrays.length} version arrays, using longest with ${longest.length} versions`)

  return longest
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
 * Get domain-specific scraping strategy for known difficult sites
 * AUTO-FIX: Automatically applies custom wait conditions for sites with complex JS rendering
 */
function getDomainSpecificStrategy(url: string): ScrapingStrategy | undefined {
  const hostname = new URL(url).hostname.toLowerCase()

  // Barco - Vue.js with slow API data loading
  if (hostname.includes('barco.com')) {
    return {
      waitForSelector: '.software-version, [class*="latest-software"], [class*="version"]',
      waitTime: 15000, // Give API time to respond
      customScript: `
        // Wait for Vue.js data binding to complete (no more "data.displayVersion" placeholders)
        console.log('⏳ Waiting for Barco Vue.js to populate version data...');
        await page.waitForFunction(() => {
          const bodyText = document.body.textContent || '';
          // Check if placeholders are gone and actual version numbers appear
          const hasPlaceholders = bodyText.includes('data.displayVersion') ||
                                 bodyText.includes('data.displayName');
          const hasVersionNumbers = /v?\\d+\\.\\d+\\.\\d+/.test(bodyText);

          if (!hasPlaceholders && hasVersionNumbers) {
            console.log('✅ Version data populated!');
            return true;
          }
          return false;
        }, { timeout: 45000 });
      `
    }
  }

  // Add more domain-specific strategies here as needed
  // Example:
  // if (hostname.includes('example.com')) {
  //   return { waitForSelector: '.version-info', waitTime: 10000 }
  // }

  return undefined
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
): Promise<{ content: string; method: string; blockerDetected?: BlockerDetection }> {
  try {
    console.log(`Fetching webpage: ${url}`)
    if (strategy) {
      console.log(`🎭 Using INTERACTIVE SCRAPING strategy`)
    } else if (useBrowserless) {
      console.log(`🌐 Using Browserless (passive rendering)`)
    }

    // Check if this is a known difficult domain
    const urlObj = new URL(url)
    const isKnownDifficult = urlObj.hostname.includes('adobe.com') ||
                            urlObj.hostname.includes('helpx.adobe') ||
                            urlObj.hostname.includes('autodesk.com') ||
                            urlObj.hostname.includes('apple.com') ||
                            urlObj.hostname.includes('pushpay.com') ||
                            urlObj.hostname.includes('force.com') || // Salesforce Community pages
                            urlObj.hostname.includes('barco.com') // Vue.js template placeholders

    if (isKnownDifficult) {
      console.warn('⚠️ Known difficult domain detected - using enhanced bot blocking protection')
    }

    // Determine starting method based on strategy and useBrowserless flag
    let startingMethod: 'static' | 'browserless' | 'browserless-extended' | 'interactive' = 'static'

    if (strategy && (strategy.releaseNotesSelectors || strategy.expandSelectors || strategy.customScript || strategy.waitForSelector)) {
      startingMethod = 'interactive'
    } else if (useBrowserless || isKnownDifficult) {
      startingMethod = isKnownDifficult ? 'browserless-extended' : 'browserless'
    }

    console.log(`🔄 Using bot blocking protection with starting method: ${startingMethod}`)

    // Use fetchWithRetry with bot blocking protection
    // REDUCED RETRIES: To prevent 504 timeouts, use fewer attempts for difficult domains
    const result = await fetchWithRetry(url, {
      browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
      startingMethod,
      scrapingStrategy: strategy, // Pass through the scraping strategy for interactive method
      retryConfig: {
        maxAttempts: isKnownDifficult ? 2 : 3, // Reduced from 5 and 4 to prevent timeouts
        baseDelay: isKnownDifficult ? 2000 : 1500, // Reduced delays
        rotateUserAgent: true,
        escalateMethods: true,
      },
    })

    const html = result.html
    const method = result.method

    // Log bot blocking detection
    if (result.blockerDetected?.isBlocked) {
      console.warn(`⚠️ Bot blocker detected: ${result.blockerDetected.blockerType}`)
      console.warn(`Confidence: ${result.blockerDetected.confidence}%`)
      console.warn(`Message: ${result.blockerDetected.message}`)
      console.warn(`Suggestion: ${result.blockerDetected.suggestedAction}`)
    }

    // Log success
    if (result.success) {
      console.log(`✅ Successfully fetched using method: ${method} after ${result.attempts} attempt(s)`)
    } else {
      console.error(`❌ Fetch failed after ${result.attempts} attempts`)
    }

    console.log(`📄 Raw HTML fetched: ${html.length} characters`)

    // PLAIN TEXT FILES: Skip HTML parsing for plain text files (GitLab/GitHub raw, .txt, etc.)
    if (isPlainTextFile(url)) {
      console.log('📝 Detected plain text file - skipping HTML parsing')

      // Clean up excessive whitespace while preserving line structure
      let content = html
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/[ \t]+/g, ' ')  // Collapse horizontal whitespace but preserve single spaces
        .replace(/\n{3,}/g, '\n\n')  // Collapse excessive blank lines
        .trim()

      console.log(`✅ Plain text processed: ${content.length} characters`)
      console.log('--- PLAIN TEXT PREVIEW ---')
      console.log(content.substring(0, 500))
      console.log('--- END PREVIEW ---')

      return {
        content,
        method: 'plain_text',
        blockerDetected: result.blockerDetected?.isBlocked ? result.blockerDetected : undefined
      }
    }

    // APPLE APP STORE: Try to extract structured JSON first
    if (url.includes('apps.apple.com')) {
      const jsonContent = extractAppleAppStoreJSON(html)
      if (jsonContent) {
        console.log(`✅ Using Apple App Store structured JSON (${jsonContent.length} chars)`)
        return {
          content: jsonContent,
          method: 'apple_json',
          blockerDetected: result.blockerDetected?.isBlocked ? result.blockerDetected : undefined
        }
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

    return {
      content,
      method,
      blockerDetected: result.blockerDetected?.isBlocked ? result.blockerDetected : undefined
    }
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
  description: string | undefined,
  aiConfig: AIConfig
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
   - **IMPORTANT**: If the version is marked as beta/alpha/rc/preview/pre, INCLUDE that in the version string
     * Example: "21.2 BETA" → "21.2-beta" (use hyphen separator)
     * Example: "21.0.1 BETA (352321797)" → "21.0.1-beta"
     * Example: "19.0 RC1" → "19.0-rc1"
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
   - **CRITICAL**: Preserve beta/alpha/rc/preview/pre/dev designations in the version string
     * If a version is labeled as beta, alpha, rc, preview, pre, or dev, APPEND it with a hyphen
     * Examples: "21.2 BETA" → "21.2-beta", "19.0 RC1" → "19.0-rc1", "3.0 Alpha" → "3.0-alpha"
     * Regular releases should NOT have any suffix: "21.2" stays "21.2"
   - For EACH version found, extract:
     * version: The version number (e.g., "1.5.0", "v2.3", "1.5.0-beta") OR feature title (see below)
     * releaseDate: Release date in YYYY-MM-DD format - **USE NULL IF NOT FOUND, DO NOT GUESS**
     * notes: Full release notes/changelog for that version (use markdown formatting)
     * type: "major" for X.0.0, "minor" for X.X.0, "patch" for X.X.X, or "minor" for features
   - Include detailed release notes if available
   - If this is a dedicated release notes/changelog page, extract ALL versions listed
   - If only one version found, still return it as an array with one element
   - Return empty array only if NO versions found anywhere
   - **CRITICAL**: Do not invent dates - only use dates explicitly mentioned in the content
   - **APPLE APP STORE PAGES**: On App Store pages, release notes appear BEFORE the version number in the text flow
     * Pattern: "notes text vX.X.X date notes text vX.X.X date"
     * Each version's notes are the text that appears IMMEDIATELY BEFORE that version number
     * Do NOT associate a version with the notes that come AFTER it
   - **FEATURE-BASED RELEASES** (RSS feeds, continuous deployment):
     * If content contains entries formatted like "=== RELEASE 1: Feature Name ===" with no numeric versions
     * Use the feature title as the "version" field (e.g., "Make in FigGov", "New image editing tools")
     * Extract the date from "Date:" field if present
     * Use the description/content as the release notes
     * Set type to "minor" for all feature releases
     * This handles software like Figma that announces features instead of numbered versions

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
      model: aiConfig.preferred_extraction_model,
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
      // temperature removed - some models only support default (1)
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

    // DISGUISE FIX: Fetch version family pages for full release notes
    // disguise organizes by major version: /r32 contains all 32.x versions, /r31 contains all 31.x versions
    if (versionUrl.includes('help.disguise.one') && versionUrl.includes('/release-notes')) {
      console.log('🎭 Detected disguise release notes - fetching version family pages...')

      const baseUrl = 'https://help.disguise.one/designer/release-notes/'

      // Group versions by major version family to minimize page fetches
      const versionFamilies = new Map<string, any[]>()

      for (const version of extracted.versions) {
        // Extract major version (e.g., "32" from "32.0.3")
        const majorVersionMatch = version.version.match(/^(\d+)/)
        if (majorVersionMatch) {
          const majorVersion = majorVersionMatch[1]
          if (!versionFamilies.has(majorVersion)) {
            versionFamilies.set(majorVersion, [])
          }
          versionFamilies.get(majorVersion)!.push(version)
        }
      }

      console.log(`  📦 Found ${versionFamilies.size} version families to fetch`)

      // Fetch each version family page (e.g., r32, r31)
      for (const [majorVersion, versions] of versionFamilies) {
        // Only fetch if versions have minimal notes
        const needsEnrichment = versions.some(v => {
          const notesText = Array.isArray(v.notes) ? v.notes.join(' ') : (v.notes || '')
          return notesText.length < 100
        })

        if (!needsEnrichment) {
          console.log(`  ⏭️  Skipping r${majorVersion} - versions already have notes`)
          continue
        }

        try {
          const familyUrl = `${baseUrl}r${majorVersion}`
          console.log(`  📄 Fetching version family page: ${familyUrl}`)

          // Fetch the version family page
          const versionPageResult = await fetchWebpageContent(familyUrl, 20000, false)

          if (versionPageResult.content.length < 500) {
            console.log(`    ⚠️  Content too short (${versionPageResult.content.length} chars), skipping family r${majorVersion}`)
            continue
          }

          console.log(`    ✅ Fetched ${versionPageResult.content.length} chars for family r${majorVersion}`)

          // Now enrich each version in this family
          for (const version of versions) {
            const notesText = Array.isArray(version.notes) ? version.notes.join(' ') : (version.notes || '')

            if (notesText.length >= 100) {
              console.log(`    ⏭️  Version ${version.version} already has notes, skipping`)
              continue
            }

            console.log(`    🔍 Extracting notes and date for version ${version.version}...`)

            // Extract notes and date for this specific version from the family page
            const notesPrompt = `Extract the release notes and release date for disguise Designer version ${version.version} from this page.

This page contains multiple versions. Find the section for version ${version.version} specifically.

Return ONLY valid JSON in this exact format:
{
  "releaseDate": "YYYY-MM-DD or null if not found",
  "notes": "Release notes content in clean markdown format"
}

IMPORTANT:
- Look for section headers like "r${version.version}" or "${version.version}"
- For releaseDate: Look for text like "Released: October 8th 2025" near this version and convert to YYYY-MM-DD format
- For notes: Extract ONLY the notes for version ${version.version}, not other versions
- Return null for releaseDate if no date is found for this version

Content (first 15000 chars):
${versionPageResult.content.substring(0, 15000)}`

            try {
              const notesResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: aiConfig.preferred_enrichment_model,
                  messages: [
                    { role: 'user', content: notesPrompt }
                  ],
                  // temperature removed - some models only support default (1)
                  response_format: { type: 'json_object' }
                })
              })

              if (notesResponse.ok) {
                const notesData = await notesResponse.json()
                const enrichedData = JSON.parse(notesData.choices[0].message.content)

                // Update the version notes
                if (enrichedData.notes && enrichedData.notes.length > 50) {
                  version.notes = enrichedData.notes
                }

                // Update release date if found
                if (enrichedData.releaseDate && enrichedData.releaseDate !== 'null') {
                  version.releaseDate = enrichedData.releaseDate
                  console.log(`      ✅ Extracted notes (${enrichedData.notes?.length || 0} chars) and date: ${enrichedData.releaseDate}`)
                } else {
                  // Fallback: Try to extract date with regex
                  const versionPattern = new RegExp(`${version.version.replace('.', '\\.')}[\\s\\S]{0,500}Released:\\s*([A-Za-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+\\d{4})`, 'i')
                  const dateMatch = versionPageResult.content.match(versionPattern)
                  if (dateMatch) {
                    console.log(`      ⚠️  AI didn't find date, trying regex: "${dateMatch[1]}"`)
                    try {
                      const dateStr = dateMatch[1].replace(/(\d+)(st|nd|rd|th)/, '$1')
                      const parsedDate = new Date(dateStr)
                      if (!isNaN(parsedDate.getTime())) {
                        version.releaseDate = parsedDate.toISOString().split('T')[0]
                        console.log(`      ✅ Extracted date via regex: ${version.releaseDate}`)
                      }
                    } catch (e) {
                      console.log(`      ❌ Failed to parse date: ${e.message}`)
                    }
                  } else {
                    console.log(`      ⚠️  No release date found for version ${version.version}`)
                  }
                  if (enrichedData.notes && enrichedData.notes.length > 50) {
                    console.log(`      ✅ Extracted notes (${enrichedData.notes.length} chars)`)
                  }
                }
              } else {
                console.log(`      ❌ AI request failed for version ${version.version}`)
              }
            } catch (error) {
              console.error(`      ❌ Error extracting version ${version.version}:`, error.message)
            }
          }
        } catch (error) {
          console.error(`    ❌ Error fetching family r${majorVersion}:`, error.message)
        }
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
  productIdentifier: string | undefined,
  description: string | undefined,
  aiConfig: AIConfig
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

3. **PRODUCT NAME MATCHING - SMART RULES:**
   - **EXACT MATCH**: If the FULL product name "${name}" appears on the page → productNameFound=true
   - **IMPLIED MANUFACTURER**: If the page is clearly about ${manufacturer} products (e.g., manufacturer's official domain, branded header/footer) AND contains the product-specific part of the name (without manufacturer prefix), this counts as finding the product
     * Example: Looking for "Resi Encoder" on support.pushpay.com → "Encoder Version 1.2.3" IS valid (manufacturer implied by domain)
     * Example: Looking for "DaVinci Resolve" on blackmagicdesign.com → "Resolve 19.1" IS valid (manufacturer implied)
     * Example: Looking for "Adobe Photoshop" on adobe.com → "Photoshop 2024" IS valid
   - **DISAMBIGUATION**: If the page contains multiple ${manufacturer} products, you MUST verify the version is for the correct product variant
     * Example: On a page with both "Encoder" and "Decoder", look for headers/sections to distinguish which version belongs to which
   - Mark productNameFound=true if EITHER exact match OR implied manufacturer match (as long as no ambiguity with other products)

4. **VERSION EXTRACTION REQUIREMENTS:**
   - The version number MUST appear in the same section/paragraph as the product identifier (full or partial name)
   - If you see other product names with version numbers, IGNORE them completely
   - Provide a confidence score (0-100) for your extraction
   - Use lower confidence (50-70) for implied manufacturer matches vs higher (80-100) for exact matches

**EXAMPLES OF CORRECT BEHAVIOR:**

✅ CORRECT Example 1 - Exact Match:
Page: "DaVinci Resolve 19.1.3 released Dec 1. Fusion Studio 19.1.3 also available."
Target: "DaVinci Resolve"
Response: { version: "19.1.3", releaseDate: "2024-12-01", confidence: 95, productNameFound: true }

✅ CORRECT Example 2 - Implied Manufacturer:
Page: "Encoder Version 1.15.4.33 - Dec 2, 2025" (on support.pushpay.com/resi domain)
Target: "Resi Encoder"
Manufacturer: "Resi"
Response: { version: "1.15.4.33", releaseDate: "2025-12-02", confidence: 85, productNameFound: true, validationNotes: "Found 'Encoder' on official Resi support page, manufacturer implied by domain" }

✅ CORRECT Example 3 - Disambiguation Required:
Page: "Encoder Version 1.15.4 released. Decoder Version 2.9.6 also available." (on resi.io)
Target: "Resi Encoder"
Response: { version: "1.15.4", confidence: 85, productNameFound: true, validationNotes: "Found Encoder section distinct from Decoder section" }

❌ WRONG Example 1:
Page: "DaVinci Resolve 19.1.3 released Dec 1. Fusion Studio 19.1.3 also available."
Target: "DaVinci Resolve"
Response: { version: "19.1.3", confidence: 50, productNameFound: false }  ← WRONG! Product name WAS found

❌ WRONG Example 2:
Page: "ATEM Mini 9.6.1 is now available"
Target: "DaVinci Resolve"
Response: { version: "9.6.1", confidence: 95 }  ← WRONG! This is ATEM's version, not DaVinci's

❌ WRONG Example 3 - Implied Manufacturer Used Incorrectly:
Page: "Encoder Version 1.2.3" (on generic tech blog)
Target: "Resi Encoder"
Response: { version: "1.2.3", productNameFound: true }  ← WRONG! Not on official Resi domain, manufacturer not implied

${hasVersionContent ? `
VERSION PAGE CONTENT (from ${versionUrl}):
${isPlainTextFile(versionUrl) && (versionUrl.includes('/raw/') || versionUrl.includes('github.com') || versionUrl.includes('gitlab')) ? '⚠️ NOTE: This is an OFFICIAL REPOSITORY FILE (changelog/NEWS from Git repository). Product name may not appear in text - versions are implied to belong to this product.\n' : ''}${versionContent}
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
   - **EXCEPTION - Official Repository Files**: For official changelog/NEWS files from the product's own repository (GitLab, GitHub /raw/ paths), the product name is implied by the repository context. Extract versions even if "${name}" doesn't appear in the text itself.
   - Return null if product name not found or version ambiguous (except for official repo files)
   - Common patterns: "Version X.X.X", "vX.X.X", "Release X.X", "Build XXXX"
   - **IMPORTANT**: If the version is marked as beta/alpha/rc/preview/pre, INCLUDE that in the version string
     * Example: "21.2 BETA" → "21.2-beta" (use hyphen separator)
     * Example: "21.0.1 BETA (352321797)" → "21.0.1-beta"
     * Example: "19.0 RC1" → "19.0-rc1"
     * Example: "Version 3.0 Alpha" → "3.0-alpha"
   - If multiple versions found, pick the LATEST one for THIS product

4. **Release Date**: Format YYYY-MM-DD
   - USE NULL if not found - DO NOT guess or make up dates
   - Only use dates explicitly stated in content
   - Convert formats: "Nov 29, 2024" → "2024-11-29"

5. **All Versions**: Extract EVERY version for "${name}" found in content
   - For EACH version: { version, releaseDate (or null), notes, type }
   - **CRITICAL**: Preserve beta/alpha/rc/preview/pre/dev designations in the version string
     * If a version is labeled as beta, alpha, rc, preview, pre, or dev, APPEND it with a hyphen
     * Examples:
       - "21.2 BETA" → "21.2-beta"
       - "21.0.1 BETA (352321797)" → "21.0.1-beta"
       - "19.0 RC1" → "19.0-rc1"
       - "Version 3.0 Alpha 2" → "3.0-alpha"
       - "2.5 Preview" → "2.5-preview"
       - "1.0 Dev" → "1.0-dev"
     * Regular releases should NOT have any suffix: "21.2" stays "21.2"
   - ONLY include versions clearly associated with "${name}"
   - **EXCEPTION - Official Repository Files**: For changelog/NEWS files from official repos, extract versions for this product branch
   - **PRODUCT VARIANT EXCLUSION - CRITICAL**: Some repositories contain multiple product variants
     * Target: "${name}"
     * EXCLUDE versions for different product variants with platform/device qualifiers:
       - If target is "VLC Media Player" → EXCLUDE "VLC for iOS", "VLC for Android", "VLC for tvOS"
       - If target is "ProPresenter" → EXCLUDE "ProPresenter for iOS", "ProPresenter Remote"
       - If target is "QLab" → EXCLUDE "QLab Remote", "QLab Video"
     * Pattern: "${name} for [Platform]" or "${name} [Variant]" are DIFFERENT products
     * Only extract versions explicitly for "${name}" without variant qualifiers
   - **DEDUPLICATION - CRITICAL**: Only extract ONE entry per unique version number
     * If you see "3.0.23 (Windows)", "3.0.23 (macOS)", "3.0.23 (Linux)" - these are the SAME version
     * Extract only ONE entry with version: "3.0.23" (no platform suffix)
     * Combine all platform-specific notes into a single entry
     * DO NOT create separate entries for platform variants
     * Example: "2.1.0", "v2.1.0", "Version 2.1.0" are all the same version - extract once as "2.1.0"
   - Exclude versions for other products
   - Include full release notes in markdown format
   - **APPLE APP STORE PAGES**: On App Store pages, release notes appear BEFORE the version number in the text flow
     * Pattern: "notes text vX.X.X date notes text vX.X.X date"
     * Each version's notes are the text that appears IMMEDIATELY BEFORE that version number
     * Do NOT associate a version with the notes that come AFTER it
   - **FEATURE-BASED RELEASES** (RSS feeds, continuous deployment):
     * If content contains entries formatted like "=== RELEASE 1: Feature Name ===" with no numeric versions
     * Use the feature title as the "version" field (e.g., "Make in FigGov", "New image editing tools")
     * Extract the date from "Date:" field if present
     * Use the description/content as the release notes
     * Set type to "minor" for all feature releases
     * This handles software like Figma that announces features instead of numbered versions

6. **Validation Fields** (REQUIRED):
   - **confidence**: 0-100 score for how confident you are this is correct
     - 90-100: Very confident, exact product name found with version nearby OR official repository file
     - 80-89: Confident, exact product name found with version present
     - 70-79: Good confidence, implied manufacturer match with clear context
     - 50-69: Moderate, implied match but some ambiguity possible
     - 30-49: Low, unclear which product or weak context
     - 0-29: Very low, likely wrong product
   - **productNameFound**: true/false - was "${name}" (or its product-specific part on official domain) found? For official repository changelog files, this should be true even if name doesn't literally appear.
   - **validationNotes**: Brief explanation of confidence level and matching strategy used

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
      model: aiConfig.preferred_extraction_model,
      messages: [
        {
          role: 'system',
          content: `You are an expert software version detective with strict validation rules.

CRITICAL RULES:
1. ONLY extract information for the specific product requested - NOT other products
2. If multiple products appear on the page, distinguish between them carefully
3. DO NOT make up or guess release dates - use null if not found
4. Provide HONEST confidence scores - use low confidence if uncertain
5. Mark productNameFound=true if EITHER:
   a) The exact product name appears on page, OR
   b) The product-specific part appears AND manufacturer is clearly implied by domain/branding (see validation rules)
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
      // temperature removed - some models only support default (1)
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
    const originalCount = extracted.versions.length

    // DEDUPLICATION: Remove duplicate versions (e.g., "3.0.23 (Windows)" and "3.0.23 (macOS)" should be one entry)
    console.log(`📋 Deduplicating versions (found ${originalCount} entries)...`)
    const versionMap = new Map<string, any>()

    for (const ver of extracted.versions) {
      // Normalize version: remove common prefixes and suffixes
      let normalized = ver.version
        .replace(/^[vr]/i, '')  // Remove v or r prefix
        .replace(/\s*\(.*?\)\s*$/g, '')  // Remove platform suffixes like "(Windows)", "(macOS)"
        .trim()

      // If this version number already exists, merge the notes
      if (versionMap.has(normalized)) {
        const existing = versionMap.get(normalized)!
        console.log(`   ⚠️ Duplicate found: "${ver.version}" → normalized to "${normalized}"`)
        // Merge notes (keep the longer/better one)
        if (ver.notes && ver.notes.length > existing.notes.length) {
          console.log(`      Keeping longer notes (${ver.notes.length} chars vs ${existing.notes.length} chars)`)
          existing.notes = ver.notes
        }
        // Keep the earliest date if available
        if (!existing.releaseDate && ver.releaseDate) {
          existing.releaseDate = ver.releaseDate
        }
      } else {
        // First time seeing this version - update version to normalized form
        ver.version = normalized
        versionMap.set(normalized, ver)
      }
    }

    // Replace with deduplicated versions
    extracted.versions = Array.from(versionMap.values())

    if (originalCount !== extracted.versions.length) {
      console.log(`✅ Deduplication: ${originalCount} versions → ${extracted.versions.length} unique versions`)
      console.log(`   Removed ${originalCount - extracted.versions.length} duplicate(s)`)
    } else {
      console.log(`✅ No duplicates found`)
    }

    // Re-sort after deduplication
    extracted.versions.sort((a, b) => compareVersions(b.version, a.version))

    // BRANCH PATTERN FILTERING: Remove versions that don't match the branch pattern
    // Example: /raw/3.0.x/NEWS should only have 3.0.* versions, not 3.7.0 (iOS version)
    if (versionUrl && (versionUrl.includes('/raw/') || versionUrl.includes('raw.githubusercontent.com'))) {
      // Extract branch pattern from URL (e.g., "3.0.x" from "/raw/3.0.x/NEWS")
      const branchMatch = versionUrl.match(/\/raw\/([^\/]+)\//)
      if (branchMatch) {
        const branch = branchMatch[1]
        console.log(`🌿 Branch detected: ${branch}`)

        // Check if branch is a version pattern (e.g., "3.0.x", "v2.1.x", "2.x")
        const versionPatternMatch = branch.match(/^v?(\d+)\.(\d+|x)/)
        if (versionPatternMatch) {
          const majorVersion = versionPatternMatch[1]
          const minorVersion = versionPatternMatch[2]

          let pattern: string
          if (minorVersion === 'x') {
            pattern = `${majorVersion}.`  // Match "3." for "3.x"
          } else {
            pattern = `${majorVersion}.${minorVersion}.`  // Match "3.0." for "3.0.x"
          }

          console.log(`🔍 Filtering versions to match branch pattern: ${pattern}*`)

          const beforeFilter = extracted.versions.length
          extracted.versions = extracted.versions.filter(ver => {
            const normalized = ver.version.replace(/^[vr]/i, '')
            const matches = normalized.startsWith(pattern)
            if (!matches) {
              console.log(`   ❌ Excluding ${ver.version} - doesn't match branch pattern ${pattern}*`)
            }
            return matches
          })

          if (beforeFilter !== extracted.versions.length) {
            console.log(`✅ Branch filtering: ${beforeFilter} versions → ${extracted.versions.length} versions matching ${pattern}*`)
          }
        }
      }
    }

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

    // DISGUISE FIX: Fetch version family pages for full release notes
    // disguise organizes by major version: /r32 contains all 32.x versions, /r31 contains all 31.x versions
    if (versionUrl.includes('help.disguise.one') && versionUrl.includes('/release-notes')) {
      console.log('🎭 Detected disguise release notes - fetching version family pages...')

      const baseUrl = 'https://help.disguise.one/designer/release-notes/'

      // Group versions by major version family to minimize page fetches
      const versionFamilies = new Map<string, any[]>()

      for (const version of extracted.versions) {
        // Extract major version (e.g., "32" from "32.0.3")
        const majorVersionMatch = version.version.match(/^(\d+)/)
        if (majorVersionMatch) {
          const majorVersion = majorVersionMatch[1]
          if (!versionFamilies.has(majorVersion)) {
            versionFamilies.set(majorVersion, [])
          }
          versionFamilies.get(majorVersion)!.push(version)
        }
      }

      console.log(`  📦 Found ${versionFamilies.size} version families to fetch`)

      // Fetch each version family page (e.g., r32, r31)
      for (const [majorVersion, versions] of versionFamilies) {
        // Only fetch if versions have minimal notes
        const needsEnrichment = versions.some(v => {
          const notesText = Array.isArray(v.notes) ? v.notes.join(' ') : (v.notes || '')
          return notesText.length < 100
        })

        if (!needsEnrichment) {
          console.log(`  ⏭️  Skipping r${majorVersion} - versions already have notes`)
          continue
        }

        try {
          const familyUrl = `${baseUrl}r${majorVersion}`
          console.log(`  📄 Fetching version family page: ${familyUrl}`)

          // Fetch the version family page
          const versionPageResult = await fetchWebpageContent(familyUrl, 20000, false)

          if (versionPageResult.content.length < 500) {
            console.log(`    ⚠️  Content too short (${versionPageResult.content.length} chars), skipping family r${majorVersion}`)
            continue
          }

          console.log(`    ✅ Fetched ${versionPageResult.content.length} chars for family r${majorVersion}`)

          // Now enrich each version in this family
          for (const version of versions) {
            const notesText = Array.isArray(version.notes) ? version.notes.join(' ') : (version.notes || '')

            if (notesText.length >= 100) {
              console.log(`    ⏭️  Version ${version.version} already has notes, skipping`)
              continue
            }

            console.log(`    🔍 Extracting notes and date for version ${version.version}...`)

            // Extract notes and date for this specific version from the family page
            const notesPrompt = `Extract the release notes and release date for disguise Designer version ${version.version} from this page.

This page contains multiple versions. Find the section for version ${version.version} specifically.

Return ONLY valid JSON in this exact format:
{
  "releaseDate": "YYYY-MM-DD or null if not found",
  "notes": "Release notes content in clean markdown format"
}

IMPORTANT:
- Look for section headers like "r${version.version}" or "${version.version}"
- For releaseDate: Look for text like "Released: October 8th 2025" near this version and convert to YYYY-MM-DD format
- For notes: Extract ONLY the notes for version ${version.version}, not other versions
- Return null for releaseDate if no date is found for this version

Content (first 15000 chars):
${versionPageResult.content.substring(0, 15000)}`

            try {
              const notesResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: aiConfig.preferred_enrichment_model,
                  messages: [
                    { role: 'user', content: notesPrompt }
                  ],
                  // temperature removed - some models only support default (1)
                  response_format: { type: 'json_object' }
                })
              })

              if (notesResponse.ok) {
                const notesData = await notesResponse.json()
                const enrichedData = JSON.parse(notesData.choices[0].message.content)

                // Update the version notes
                if (enrichedData.notes && enrichedData.notes.length > 50) {
                  version.notes = enrichedData.notes
                }

                // Update release date if found
                if (enrichedData.releaseDate && enrichedData.releaseDate !== 'null') {
                  version.releaseDate = enrichedData.releaseDate
                  console.log(`      ✅ Extracted notes (${enrichedData.notes?.length || 0} chars) and date: ${enrichedData.releaseDate}`)
                } else {
                  // Fallback: Try to extract date with regex
                  const versionPattern = new RegExp(`${version.version.replace('.', '\\.')}[\\s\\S]{0,500}Released:\\s*([A-Za-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+\\d{4})`, 'i')
                  const dateMatch = versionPageResult.content.match(versionPattern)
                  if (dateMatch) {
                    console.log(`      ⚠️  AI didn't find date, trying regex: "${dateMatch[1]}"`)
                    try {
                      const dateStr = dateMatch[1].replace(/(\d+)(st|nd|rd|th)/, '$1')
                      const parsedDate = new Date(dateStr)
                      if (!isNaN(parsedDate.getTime())) {
                        version.releaseDate = parsedDate.toISOString().split('T')[0]
                        console.log(`      ✅ Extracted date via regex: ${version.releaseDate}`)
                      }
                    } catch (e) {
                      console.log(`      ❌ Failed to parse date: ${e.message}`)
                    }
                  } else {
                    console.log(`      ⚠️  No release date found for version ${version.version}`)
                  }
                  if (enrichedData.notes && enrichedData.notes.length > 50) {
                    console.log(`      ✅ Extracted notes (${enrichedData.notes.length} chars)`)
                  }
                }
              } else {
                console.log(`      ❌ AI request failed for version ${version.version}`)
              }
            } catch (error) {
              console.error(`      ❌ Error extracting version ${version.version}:`, error.message)
            }
          }
        } catch (error) {
          console.error(`    ❌ Error fetching family r${majorVersion}:`, error.message)
        }
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
    versionContent + ' ' + mainWebsiteContent,
    versionUrl  // Pass source URL for official repository file detection
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

/**
 * Check if URL points to a plain text file (not HTML)
 */
function isPlainTextFile(url: string, contentType?: string): boolean {
  if (!url) return false;

  // Check Content-Type header if available
  if (contentType) {
    const lowerType = contentType.toLowerCase();
    if (lowerType.includes('text/plain')) return true;
    if (lowerType.includes('text/markdown')) return true;
    // Explicitly HTML should not be treated as plain text
    if (lowerType.includes('text/html')) return false;
  }

  const lowerUrl = url.toLowerCase();

  // GitLab and GitHub raw file endpoints
  if (lowerUrl.includes('/raw/')) return true;
  if (lowerUrl.includes('/raw.githubusercontent.com/')) return true;

  // Plain text file extensions
  if (lowerUrl.endsWith('.txt')) return true;
  if (lowerUrl.endsWith('.text')) return true;
  if (lowerUrl.endsWith('.md')) return true;
  if (lowerUrl.endsWith('.markdown')) return true;

  // Common changelog/release notes plain text files
  if (lowerUrl.match(/\/(changelog|changes|news|history|releases?)(\.txt)?$/i)) return true;

  return false;
}

/**
 * Auto-detect source type from URL
 */
function detectSourceType(url: string): 'webpage' | 'rss' | 'forum' | 'pdf' | 'plaintext' {
  if (!url) return 'webpage';

  const lowerUrl = url.toLowerCase();

  // PDF detection
  if (lowerUrl.endsWith('.pdf')) {
    return 'pdf';
  }

  // Plain text detection
  if (isPlainTextFile(url)) {
    return 'plaintext';
  }

  // RSS/Atom feed detection
  if (
    lowerUrl.includes('/feed') ||
    lowerUrl.includes('/rss') ||
    lowerUrl.endsWith('.xml') ||
    lowerUrl.endsWith('.rss') ||
    lowerUrl.endsWith('.atom') ||
    lowerUrl.includes('feed.xml') ||
    lowerUrl.includes('rss.xml') ||
    lowerUrl.includes('atom.xml')
  ) {
    return 'rss';
  }

  // Forum detection (phpBB, Discourse, vBulletin, etc.)
  if (
    lowerUrl.includes('viewforum.php') ||
    lowerUrl.includes('viewtopic.php') ||
    lowerUrl.includes('/forums/') ||
    lowerUrl.includes('/forum/') ||
    lowerUrl.includes('/community/') ||
    lowerUrl.includes('/discuss/') ||
    lowerUrl.includes('showthread.php') ||
    lowerUrl.includes('forumdisplay.php')
  ) {
    return 'forum';
  }

  // Default to webpage
  return 'webpage';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, website, versionUrl, description, content, manufacturer, productIdentifier, scrapingStrategy: providedStrategy, sourceType, forumConfig } = await req.json() as ExtractRequest

    if (!name || !website) {
      return new Response(
        JSON.stringify({ error: 'name and website are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // AUTO-FIX: Apply domain-specific strategy if none provided
    // Only apply if versionUrl is a valid URL (not for PDF uploads or other content-provided scenarios)
    let scrapingStrategy = providedStrategy
    if (!scrapingStrategy && versionUrl && !content) {
      try {
        // Validate that versionUrl is a valid URL before trying to parse it
        new URL(versionUrl) // This will throw if invalid
        const autoStrategy = getDomainSpecificStrategy(versionUrl)
        if (autoStrategy) {
          console.log(`🎯 AUTO-APPLIED domain-specific scraping strategy for ${new URL(versionUrl).hostname}`)
          scrapingStrategy = autoStrategy
        }
      } catch (urlError) {
        // versionUrl is not a valid URL (e.g., "PDF Upload"), skip strategy detection
        console.log(`⚠️ Skipping domain strategy detection - versionUrl is not a valid URL: ${versionUrl}`)
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing extraction for: ${name}`)
    console.log(`Version URL: ${versionUrl}`)
    console.log(`Main Website: ${website}`)
    console.log(`Manufacturer: ${manufacturer || 'unknown'}`)
    console.log(`Product Identifier: ${productIdentifier || 'none'}`)
    console.log(`Extraction Mode: ${USE_ENHANCED_EXTRACTION ? '🧠 ENHANCED (Phase 2)' : '📊 LEGACY (Original)'}`)
    console.log(`Interactive Scraping: ${scrapingStrategy ? '🎭 YES (Phase 3)' : '❌ NO'}`)
    console.log(`Source Type: ${sourceType || 'auto-detect'}`)
    console.log(`Has provided content: ${!!content}`)
    console.log('='.repeat(60))

    // Get AI model configuration
    const aiConfig = await getAIConfig()
    console.log(`🤖 Using models: extraction=${aiConfig.preferred_extraction_model}, enrichment=${aiConfig.preferred_enrichment_model}`)

    let versionContent = ''
    let mainWebsiteContent = ''
    let fetchMethod = 'static' // Track which method was used for version content

    // Determine source type (auto-detect if not provided)
    // BUT: validate provided source type and override if clearly wrong
    let detectedSourceType = sourceType || detectSourceType(versionUrl)

    // Validation: Check if provided source type conflicts with URL pattern
    if (sourceType && versionUrl) {
      const autoDetected = detectSourceType(versionUrl)

      // If URL is clearly a plain text file but source type says RSS/forum/etc, override it
      if (autoDetected === 'plaintext' && sourceType !== 'plaintext') {
        console.log(`⚠️ Source type override: Database says '${sourceType}' but URL pattern indicates 'plaintext'`)
        console.log(`   Overriding to 'plaintext' for ${versionUrl}`)
        detectedSourceType = 'plaintext'
      }
      // Similarly, if URL is clearly PDF but says something else
      else if (autoDetected === 'pdf' && sourceType !== 'pdf') {
        console.log(`⚠️ Source type override: Database says '${sourceType}' but URL ends with .pdf`)
        console.log(`   Overriding to 'pdf' for ${versionUrl}`)
        detectedSourceType = 'pdf'
      }
      // Warn if there's a mismatch but we're not overriding
      else if (autoDetected !== sourceType) {
        console.log(`⚠️ Source type mismatch: Database='${sourceType}', Auto-detected='${autoDetected}'`)
        console.log(`   Using database value, but this may cause issues`)
      }
    }

    console.log(`📍 Detected source type: ${detectedSourceType}`)

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
      // Route based on source type
      if (detectedSourceType === 'rss') {
        // RSS Feed
        console.log(`📡 Source type: RSS feed`)
        try {
          versionContent = await fetchRSSContent(versionUrl)
          fetchMethod = 'rss'
        } catch (rssError) {
          console.error('RSS fetch failed:', rssError)
          versionContent = ''
          fetchMethod = 'error'
        }

        // Still fetch main website for manufacturer/category info
        if (versionUrl.toLowerCase() !== website.toLowerCase()) {
          const mainResult = await fetchWebpageContent(website, 20000, false)
          mainWebsiteContent = mainResult.content
        }
      } else if (detectedSourceType === 'forum') {
        // Forum
        console.log(`🗨️ Source type: Forum`)
        console.log(`Forum config:`, forumConfig)
        try {
          versionContent = await fetchForumContent(versionUrl, forumConfig || {}, false, 10, scrapingStrategy)
          fetchMethod = 'forum'
        } catch (forumError) {
          console.error('Forum fetch failed:', forumError)
          versionContent = ''
          fetchMethod = 'error'
        }

        // Still fetch main website for manufacturer/category info
        if (versionUrl.toLowerCase() !== website.toLowerCase()) {
          const mainResult = await fetchWebpageContent(website, 20000, false)
          mainWebsiteContent = mainResult.content
        }
      } else if (detectedSourceType === 'pdf') {
        // PDF
        console.log(`📄 Detected PDF URL: ${versionUrl}`)

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
        // Regular webpage (default)
        console.log(`🌐 Source type: Webpage`)
        // Fetch content from both URLs in parallel (try regular fetch first)
        // Phase 3: Pass scraping strategy if provided
        const [versionResult, mainResult] = await Promise.all([
          fetchWebpageContent(versionUrl, 60000, false, scrapingStrategy),
          // Only fetch main website if it's different from version URL
          versionUrl.toLowerCase() !== website.toLowerCase()
            ? fetchWebpageContent(website, 20000, false)
            : Promise.resolve({ content: '', method: 'skipped' })
        ])

        versionContent = versionResult.content
        mainWebsiteContent = mainResult.content
        fetchMethod = versionResult.method

        // Track bot blocker detection
        if (versionResult.blockerDetected) {
          console.log(`\n🚫 Bot blocker detected during initial fetch:`)
          console.log(`  Type: ${versionResult.blockerDetected.blockerType}`)
          console.log(`  Confidence: ${versionResult.blockerDetected.confidence}%`)
          console.log(`  Message: ${versionResult.blockerDetected.message}`)
        }
      }

      console.log(`\n=== INITIAL CONTENT LENGTHS ===`)
      console.log(`Version content length: ${versionContent.length}`)
      console.log(`Main website content length: ${mainWebsiteContent.length}`)
      console.log(`Fetch method: ${fetchMethod}`)

      // Detect if this is likely a JavaScript-rendered page
      const isLikelyJavaScriptPage = versionContent.length < 2000
      const hasVeryLowContent = versionContent.length < 500

      // Retry with Browserless if content is low AND we haven't already tried interactive/browserless
      // Only for webpages, not for RSS/forum/PDF sources
      if (isLikelyJavaScriptPage && detectedSourceType === 'webpage' && fetchMethod === 'static') {
        console.log(`⚠️ WARNING: Low content detected (${versionContent.length} chars) - likely JavaScript-rendered page`)
        console.log(`🔄 Retrying with Browserless (headless Chrome)...`)

        // Retry with Browserless for JavaScript pages
        const retryResult = await fetchWebpageContent(versionUrl, 60000, true, scrapingStrategy)
        versionContent = retryResult.content
        fetchMethod = retryResult.method

        console.log(`\n=== AFTER BROWSERLESS ===`)
        console.log(`Version content length: ${versionContent.length}`)
        console.log(`Fetch method: ${fetchMethod}`)

        if (versionContent.length > 2000) {
          console.log(`✅ SUCCESS: Browserless extracted much more content!`)
        }

        // LONG-TERM FIX: Detect loader/framework code patterns
        // Common patterns in JavaScript frameworks that indicate page hasn't fully loaded
        const loaderPatterns = [
          /Loading.*Sorry to interrupt/i,
          /Loading.*CSS Error/i,
          /Please wait.*loading/i,
          /<div id="root"><\/div>/i,
          /<div id="app"><\/div>/i,
          /cookieEnabled.*cookieMessage/i,
          /slds-modal.*slds-fade-in-open/i, // Salesforce Lightning
          /data\.display(Version|version|Name|name)/i, // Vue.js data binding (e.g., "Version data.displayVersion")
          /\{\{.*version.*\}\}/i, // Mustache/Vue templates (e.g., "{{version}}")
          /\$\{.*version.*\}/i, // Template literals (e.g., "${version}")
          /\[\[.*version.*\]\]/i, // Angular/other framework bindings
        ]

        const hasLoaderCode = loaderPatterns.some(pattern => pattern.test(versionContent))
        const hasMinimalActualContent = versionContent.replace(/<[^>]+>/g, '').trim().length < 500

        if (hasLoaderCode && hasMinimalActualContent && fetchMethod === 'browserless') {
          console.log(`⚠️ LOADER CODE DETECTED: Page returned framework/loader code instead of content`)
          console.log(`🔄 Retrying with EXTENDED timeout (60s) for slow-loading page...`)

          // Retry with extended Browserless timeout (60 seconds)
          const extendedRetry = await fetchWebpageContent(versionUrl, 60000, true, scrapingStrategy)
          versionContent = extendedRetry.content
          fetchMethod = extendedRetry.method

          console.log(`\n=== AFTER EXTENDED BROWSERLESS ===`)
          console.log(`Version content length: ${versionContent.length}`)
          console.log(`Fetch method: ${fetchMethod}`)

          // Check if we still have loader code
          const stillHasLoaderCode = loaderPatterns.some(pattern => pattern.test(versionContent))
          if (stillHasLoaderCode) {
            console.warn(`⚠️ Still detecting loader code after extended timeout - page may require interactive scraping`)
            console.warn(`💡 RECOMMENDATION: This page likely needs one of the following:`)
            console.warn(`   1. Interactive scraping (click buttons, wait for API responses)`)
            console.warn(`   2. Authentication to view version data`)
            console.warn(`   3. Scroll/interaction to trigger lazy loading`)
            console.warn(`   Detected placeholders in content: ${loaderPatterns.filter(p => p.test(versionContent)).map(p => p.source).join(', ')}`)
          } else {
            console.log(`✅ SUCCESS: Extended timeout resolved loader code issue!`)
          }
        }
      }
    }

    // Apply smart content extraction (Phase 4: Smart Windowing)
    // Search the FULL content for product mentions, extract windows around them
    // This ensures we find the product even if buried deep in the page
    // EXCEPTION: Skip for official repository files - they're structured linearly
    const isOfficialRepo = isOfficialRepoFile(versionUrl)

    if (isOfficialRepo && versionContent.length > 30000) {
      // For official repo changelog files, take from the beginning (newest versions first)
      console.log('📝 Official repo file detected - using linear extraction from beginning')
      console.log(`   Truncating from ${versionContent.length} to 30000 chars (preserves newest versions)`)
      versionContent = versionContent.substring(0, 30000)
    } else if (versionContent.length > 1000 && name && !isOfficialRepo) {
      // Regular smart windowing for webpages
      console.log('\n🎯 Applying smart content extraction...')
      const smartResult = extractSmartContent(versionContent, name, 60000)

      if (smartResult.foundProduct) {
        console.log(`✅ Smart extraction successful - found product! (${smartResult.method})`)
        versionContent = smartResult.content
      } else {
        console.log(`⚠️ Product not found in ${versionContent.length} chars, using first chunk (${smartResult.method})`)
        versionContent = smartResult.content
      }
    } else if (versionContent.length > 60000) {
      // If no product name provided, just truncate to reasonable size
      console.log(`⚠️ No product name for smart extraction, truncating to 60K`)
      versionContent = versionContent.substring(0, 60000)
    }

    // CRITICAL: Also limit mainWebsiteContent to prevent token limit errors
    // Main website content is primarily used for manufacturer/category extraction
    // which is typically found at the top of the page
    const MAX_MAIN_CONTENT = 15000 // Conservative limit to stay within API token limits
    if (mainWebsiteContent.length > MAX_MAIN_CONTENT) {
      console.log(`📏 Truncating main website content from ${mainWebsiteContent.length} to ${MAX_MAIN_CONTENT} chars`)

      // Try smart extraction first if we have a product name
      if (name && mainWebsiteContent.length > 1000) {
        const smartResult = extractSmartContent(mainWebsiteContent, name, MAX_MAIN_CONTENT)
        mainWebsiteContent = smartResult.content
        console.log(`  ✅ Used smart extraction (found product: ${smartResult.foundProduct})`)
      } else {
        // Otherwise just take the beginning (manufacturer/category usually at top)
        mainWebsiteContent = mainWebsiteContent.substring(0, MAX_MAIN_CONTENT)
        console.log(`  ✅ Used simple truncation`)
      }
    }

    // Log what we're actually sending to the AI
    console.log(`\n=== FINAL CONTENT SIZES AFTER LIMITING ===`)
    console.log(`Version content: ${versionContent.length} chars`)
    console.log(`Main website content: ${mainWebsiteContent.length} chars`)
    console.log(`Total: ${versionContent.length + mainWebsiteContent.length} chars (~${Math.ceil((versionContent.length + mainWebsiteContent.length) / 4)} tokens estimated)`)
    console.log(`\n=== VERSION CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(versionContent.substring(0, 1000))
    console.log(`\n=== MAIN WEBSITE CONTENT BEING SENT TO AI (first 1000 chars) ===`)
    console.log(mainWebsiteContent.substring(0, 1000))
    console.log(`\n=== END CONTENT PREVIEW ===`)

    // Re-check if still low content after Browserless
    const stillLowContent = versionContent.length < 2000
    const noContentAtAll = versionContent.length === 0

    // Check if this is a known difficult domain (skip sitemap for these to save time)
    const isKnownDifficultDomain = versionUrl && (
      versionUrl.includes('adobe.com') ||
      versionUrl.includes('apple.com') ||
      versionUrl.includes('autodesk.com') ||
      versionUrl.includes('pushpay.com') ||
      versionUrl.includes('force.com') ||
      versionUrl.includes('barco.com')
    )

    // Try sitemap discovery if webpage content is low and this is a webpage source
    // Skip for known difficult domains as it wastes time and rarely works
    if (stillLowContent && detectedSourceType === 'webpage' && website && !isKnownDifficultDomain) {
      console.log('\n🗺️ Low content detected, attempting sitemap discovery...')
      try {
        const releaseUrls = await discoverReleaseUrls(website, 3)

        if (releaseUrls.length > 0) {
          console.log(`✅ Found ${releaseUrls.length} potential release pages from sitemap`)

          // Try fetching content from the best sitemap URLs
          for (const sitemapUrl of releaseUrls) {
            console.log(`  → Trying: ${sitemapUrl.loc} (score: ${sitemapUrl.relevanceScore})`)

            try {
              const sitemapResult = await fetchWebpageContent(sitemapUrl.loc, 30000, false)

              if (sitemapResult.content.length > versionContent.length) {
                console.log(`  ✅ Found better content (${sitemapResult.content.length} chars vs ${versionContent.length} chars)`)
                versionContent = sitemapResult.content
                fetchMethod = sitemapResult.method + '_sitemap'

                // If we found good content, stop searching
                if (sitemapResult.content.length >= 5000) {
                  console.log('  🎯 Good content found, stopping sitemap search')
                  break
                }
              } else {
                console.log(`  ⏭️  Content not better than current (${sitemapResult.content.length} chars)`)
              }
            } catch (error) {
              console.warn(`  ❌ Failed to fetch sitemap URL: ${error.message}`)
            }
          }
        } else {
          console.log('⚠️ No relevant URLs found in sitemap')
        }
      } catch (error) {
        console.warn(`⚠️ Sitemap discovery failed: ${error.message}`)
        // Continue with original content
      }
    }

    // Re-check content after sitemap discovery
    const stillLowContentAfterSitemap = versionContent.length < 2000
    const noContentAtAllAfterSitemap = versionContent.length === 0

    // Detect if site is completely blocking us (0 chars even after all retries)
    if (noContentAtAllAfterSitemap && versionUrl) {
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
          description,
          aiConfig
        )
      } else {
        console.log('\n📊 Using LEGACY extraction (original system)')
        extracted = await extractWithAI(
          name,
          website,
          versionUrl,
          versionContent,
          mainWebsiteContent,
          description,
          aiConfig
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
    if (stillLowContentAfterSitemap) {
      extracted.isJavaScriptPage = true

      // Provide specific warning based on situation
      if (noContentAtAllAfterSitemap) {
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
