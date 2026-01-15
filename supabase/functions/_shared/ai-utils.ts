// Shared AI utilities for enhanced release notes extraction and merging
// Handles: web search, AI tracking, smart merging, cost control

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9'
import type { StructuredNotes, MergeMetadata } from './types.ts'

// ============================================
// Configuration
// ============================================

export interface AIConfig {
  web_search_enabled: boolean
  max_web_searches_per_day: number
  smart_merge_enabled: boolean
  preferred_extraction_model: string
  preferred_merge_model: string
  preferred_parsing_model: string
  preferred_enrichment_model: string
  web_search_domains: string[]
}

export async function getAIConfig(): Promise<AIConfig> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('ai_config')
    .select('key, value')

  if (error) {
    console.error('Error fetching AI config:', error)
    // Return safe defaults
    return {
      web_search_enabled: true,
      max_web_searches_per_day: 500,
      smart_merge_enabled: true,
      preferred_extraction_model: 'gpt-5.1',
      preferred_merge_model: 'gpt-5-mini',
      preferred_parsing_model: 'gpt-5-mini',
      preferred_enrichment_model: 'gpt-5-mini',
      web_search_domains: []
    }
  }

  const config: any = {}
  data?.forEach(item => {
    try {
      config[item.key] = JSON.parse(item.value as string)
    } catch {
      config[item.key] = item.value
    }
  })

  return {
    web_search_enabled: config.web_search_enabled ?? true,
    max_web_searches_per_day: config.max_web_searches_per_day ?? 500,
    smart_merge_enabled: config.smart_merge_enabled ?? true,
    preferred_extraction_model: config.preferred_extraction_model ?? 'gpt-5.1',
    preferred_merge_model: config.preferred_merge_model ?? 'gpt-5-mini',
    preferred_parsing_model: config.preferred_parsing_model ?? 'gpt-5-mini',
    preferred_enrichment_model: config.preferred_enrichment_model ?? 'gpt-5-mini',
    web_search_domains: config.web_search_domains ?? []
  }
}

// ============================================
// Usage Tracking
// ============================================

export async function trackAIUsage(
  operationType: 'web_search' | 'extraction' | 'merge' | 'comparison',
  model: string,
  tokensInput: number = 0,
  tokensOutput: number = 0,
  toolCalls: number = 0
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the tracking function
    const { error } = await supabase.rpc('track_ai_usage', {
      p_operation_type: operationType,
      p_model: model,
      p_tokens_input: tokensInput,
      p_tokens_output: tokensOutput,
      p_tool_calls: toolCalls
    })

    if (error) {
      console.error('Error tracking AI usage:', error)
    }
  } catch (error) {
    console.error('Failed to track AI usage:', error)
    // Don't throw - tracking failures shouldn't break the main flow
  }
}

export async function checkWebSearchLimit(): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.rpc('check_web_search_limit')

    if (error) {
      console.error('Error checking web search limit:', error)
      return true // Fail open
    }

    return data as boolean
  } catch (error) {
    console.error('Failed to check web search limit:', error)
    return true // Fail open
  }
}

/**
 * Determine enrichment strategy based on existing notes quality and source
 * Returns: 'skip' | 'search' | 'merge'
 */
export interface EnrichmentDecision {
  action: 'skip' | 'search' | 'merge'
  reason: string
  notesLength: number
}

export function shouldEnrichWithWebSearch(
  notes: string | string[],
  sourceUrl?: string
): EnrichmentDecision {
  // Normalize notes to array and calculate total length
  const notesArray = typeof notes === 'string'
    ? notes.split('\n').filter(Boolean)
    : (Array.isArray(notes) ? notes : [])

  const notesText = notesArray.join(' ')
  const notesLength = notesText.length

  // Check if source is an official repository file
  const isOfficialRepo = sourceUrl && (
    sourceUrl.includes('/raw/') ||
    sourceUrl.includes('raw.githubusercontent.com')
  )

  // TIER 1: Skip web search for substantial official sources
  if (notesLength > 500 && isOfficialRepo) {
    return {
      action: 'skip',
      reason: `Already have ${notesLength} chars from official repo - skipping web search`,
      notesLength
    }
  }

  // TIER 2: Always search for minimal/missing notes
  if (notesLength < 100) {
    return {
      action: 'search',
      reason: `Notes minimal (${notesLength} chars) - performing web search`,
      notesLength
    }
  }

  // TIER 3: Merge for middle ground (100-500 chars, or non-repo sources)
  return {
    action: 'merge',
    reason: `Notes exist (${notesLength} chars) - web search will enhance/merge`,
    notesLength
  }
}

// ============================================
// Web Search Enhanced Extraction
// ============================================

export interface WebSearchExtractionResult {
  version: string
  structured_notes: StructuredNotes
  sources: string[]
  notes_source: 'auto'
  raw_notes: string[]
  release_date?: string | null  // Fixed: Added missing release_date field
}

export async function extractWithWebSearch(
  softwareName: string,
  manufacturer: string,
  detectedVersion: string,
  websiteUrl: string,
  additionalDomains: string[] = []
): Promise<WebSearchExtractionResult | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const config = await getAIConfig()

  // Check if web search is enabled
  if (!config.web_search_enabled) {
    console.log('Web search disabled by config')
    return null
  }

  // Check daily limit
  const withinLimit = await checkWebSearchLimit()
  if (!withinLimit) {
    console.warn('Daily web search limit reached')
    return null
  }

  // Build allowed domains list
  const baseDomain = websiteUrl.replace(/^https?:\/\//, '').split('/')[0]

  // Extract the root domain (e.g., "teradek.com" from "www.teradek.com" or "support.teradek.com")
  // This handles: domain.com, www.domain.com, subdomain.domain.com, etc.
  const domainParts = baseDomain.split('.')
  const rootDomain = domainParts.length >= 2
    ? domainParts.slice(-2).join('.') // Take last 2 parts (domain.tld)
    : baseDomain

  // Include TOP 5 most important documentation/support subdomains
  // OPTIMIZATION: Reduced from 13 to 5 to speed up web search (20-30% faster)
  const commonSubdomains = [
    rootDomain,
    `www.${rootDomain}`,
    `docs.${rootDomain}`,
    `support.${rootDomain}`,
    `downloads.${rootDomain}`
    // Removed: documentation, help, guide, download, update, updates, kb, knowledgebase
  ]

  const allowedDomains = [
    ...commonSubdomains,
    'github.com',
    ...additionalDomains,
    ...config.web_search_domains
  ].filter(Boolean)

  console.log('🔍 Extracting with web search:', {
    software: softwareName,
    version: detectedVersion,
    domains: allowedDomains
  })

  try {
    // OPTIMIZATION: Add 90s timeout to prevent Edge Function 504 errors
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.warn(`⏰ OpenAI API timeout after 90s for ${softwareName} ${detectedVersion}`)
      controller.abort()
    }, 90000) // 90 second timeout (leaves 60s buffer before 150s Edge Function limit)

    try {
      // Use OpenAI Responses API with web search
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,  // OPTIMIZATION: Add abort signal
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.preferred_extraction_model,
          reasoning: { effort: 'low' }, // OPTIMIZATION: Changed from 'medium' to 'low' (40-60% faster)
          tools: [{
            type: 'web_search',
            filters: {
              allowed_domains: allowedDomains
            }
          }],
          tool_choice: 'auto',
          include: ['web_search_call.action.sources'],
          input: `Find the official release notes for ${softwareName} version ${detectedVersion}.

PRIMARY SOURCE: Check ${websiteUrl} first - this is the official release notes page.

All domains including subdomains (update.*, docs.*, support.*, guide.*, downloads.*) are official sources - use them freely.

RESPONSE FORMAT:
- If you find release notes, extract them in a clear, structured format
- If no release notes are found, respond with exactly: "No release notes found for version ${detectedVersion}"
- Do NOT include explanations about domain restrictions or what you can/cannot access
- Do NOT mention third-party sites or sources you cannot use

EXTRACT:
1. Release date (YYYY-MM-DD format) - check the specific version ${detectedVersion}
2. New features and changes
3. Bug fixes
4. Known issues and notices
5. Compatibility and upgrade information

Start with "Released: YYYY-MM-DD" if found, then list the details.`
        })
      })

      // Clear timeout on successful completion
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Web search API error:', response.status, errorText)
        return null
      }

      const result = await response.json()

      // Extract sources from web_search_call items
      const sources: string[] = []
      const webSearchCalls = result.output?.filter((item: any) => item.type === 'web_search_call') || []

      for (const call of webSearchCalls) {
        if (call.action?.sources) {
          sources.push(...call.action.sources.map((s: any) => s.url || s))
        }
      }

      // Get the text output
      const messageItems = result.output?.filter((item: any) => item.type === 'message') || []
      const textContent = messageItems[0]?.content?.find((c: any) => c.type === 'output_text')?.text || ''

      if (!textContent) {
        console.warn('No text content in web search response')
        clearTimeout(timeoutId)
        return null
      }

      // Track usage
      await trackAIUsage(
        'web_search',
        config.preferred_extraction_model,
        result.usage?.input_tokens || 0,
        result.usage?.output_tokens || 0,
        webSearchCalls.length
      )

      // Extract release date from the text content (format: "Released: YYYY-MM-DD")
      const releaseDateMatch = textContent.match(/Released:\s*(\d{4}-\d{2}-\d{2})/i)
      const releaseDate = releaseDateMatch ? releaseDateMatch[1] : null

      // Parse the response into structured notes
      const structured = await parseIntoStructuredNotes(textContent, config.preferred_parsing_model)

      // Also create raw notes array (backward compatibility)
      const rawNotes = convertStructuredToRawNotes(structured)

      console.log('✅ Web search extraction successful:', {
        sources: sources.length,
        sections: Object.keys(structured).length,
        releaseDate: releaseDate || 'not found'
      })

      return {
        version: detectedVersion,
        structured_notes: structured,
        sources: sources,
        notes_source: 'auto',
        raw_notes: rawNotes,
        release_date: releaseDate
      }

    } catch (error) {
      clearTimeout(timeoutId)

      // Handle abort/timeout errors gracefully
      if (error.name === 'AbortError') {
        console.error(`⏰ Web search aborted after 90s timeout for ${softwareName} ${detectedVersion}`)
        return null
      }

      throw error // Re-throw other errors to outer catch
    }

  } catch (error) {
    console.error('Web search extraction failed:', error)
    return null
  }
}

// ============================================
// Parse into Structured Notes
// ============================================

async function parseIntoStructuredNotes(
  releaseNotesText: string,
  model: string
): Promise<StructuredNotes> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model, // Use configured parsing model
      messages: [{
        role: 'system',
        content: `You are parsing release notes into structured sections. Extract information into these categories:
- new_features: New functionality added
- changes: Modifications to existing features
- improvements: Performance or usability enhancements
- bug_fixes: Bugs that were fixed
- known_issues: Known problems or limitations
- notices: Important information, warnings, or announcements
- compatibility: Compatibility information, requirements
- upgrade_instructions: How to upgrade or migrate

Return ONLY valid JSON. Each field should be an array of strings. Only include fields that have content.`
      }, {
        role: 'user',
        content: `Parse these release notes:\n\n${releaseNotesText}`
      }],
      response_format: { type: "json_object" }
      // Note: temperature removed - some models (o1 series) only support default (1)
    })
  })

  const result = await response.json()

  // Check if response is valid
  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    console.error('Invalid OpenAI response in parseIntoStructuredNotes:', result)
    return {} as StructuredNotes
  }

  const parsed = JSON.parse(result.choices[0].message.content)

  // Track usage
  await trackAIUsage(
    'extraction',
    model,
    result.usage?.prompt_tokens || 0,
    result.usage?.completion_tokens || 0,
    0
  )

  return parsed as StructuredNotes
}

// ============================================
// Smart Merge Function
// ============================================

export interface MergeResult {
  structured_notes: StructuredNotes
  raw_notes: string[]
  notes_source: 'merged'
  merge_metadata: MergeMetadata
}

export async function smartMergeNotes(
  existingNotes: {
    notes: string[]
    structured_notes?: StructuredNotes
    notes_source?: string
  },
  newNotes: {
    structured_notes: StructuredNotes
    raw_notes: string[]
  }
): Promise<MergeResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!
  const config = await getAIConfig()

  if (!config.smart_merge_enabled) {
    // If merge disabled, just return new notes
    return {
      structured_notes: newNotes.structured_notes,
      raw_notes: newNotes.raw_notes,
      notes_source: 'merged',
      merge_metadata: {
        merged_at: new Date().toISOString(),
        had_manual_notes: false,
        sources_combined: ['auto'],
        ai_model_used: 'none',
        merge_strategy: 'full'
      }
    }
  }

  console.log('🔀 Merging notes:', {
    existing_source: existingNotes.notes_source,
    existing_sections: existingNotes.structured_notes ? Object.keys(existingNotes.structured_notes).length : 0,
    new_sections: Object.keys(newNotes.structured_notes).length
  })

  const mergePrompt = `You are merging release notes from two sources to create a comprehensive version.

EXISTING NOTES (may include manual edits, testing notes, internal observations):
${formatNotesForMerge(existingNotes)}

NEW AUTO-EXTRACTED NOTES (from official release notes via web search):
${formatNotesForMerge(newNotes)}

CRITICAL QUALITY RULES:
1. If NEW notes contain placeholder text like "No specific release notes", "No release notes found", "Not available", or similar non-informative content, IGNORE them completely and keep EXISTING notes
2. If NEW notes have less specific information than EXISTING notes, prefer EXISTING notes
3. Only use NEW notes if they contain actual, specific release information

Create a comprehensive merged version that:
1. Includes ALL unique information from both sources
2. Removes exact duplicates
3. Combines similar items intelligently
4. Preserves manual annotations (mark them with [Manual] prefix if not in official notes)
5. Prioritizes quality over recency - keep the most informative content
6. Organizes into sections: new_features, changes, improvements, bug_fixes, known_issues, notices, compatibility, upgrade_instructions
7. Maintains clarity and readability

Return ONLY valid JSON with these section fields (as arrays of strings).
Only include sections that have content.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.preferred_merge_model,
        messages: [{
          role: 'system',
          content: 'You are an expert at merging release notes while preserving all valuable information.'
        }, {
          role: 'user',
          content: mergePrompt
        }],
        response_format: { type: "json_object" }
        // Note: temperature removed - some models (o1 series) only support default (1)
      })
    })

    const result = await response.json()

    // Check if response is valid
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('Invalid OpenAI response in smartMergeNotes:', result)
      // Fallback: return existing notes unchanged
      return {
        structured_notes: existingNotes.structured_notes || {},
        raw_notes: existingNotes.notes || [],
        notes_source: 'merged',
        merge_metadata: {
          merged_at: new Date().toISOString(),
          had_manual_notes: existingNotes.notes_source === 'manual',
          sources_combined: [existingNotes.notes_source || 'unknown', 'auto'],
          ai_model_used: 'fallback-error',
          merge_strategy: 'keep-existing'
        }
      }
    }

    const merged: StructuredNotes = JSON.parse(result.choices[0].message.content)

    // Track usage
    await trackAIUsage(
      'merge',
      config.preferred_merge_model,
      result.usage?.prompt_tokens || 0,
      result.usage?.completion_tokens || 0,
      0
    )

    // Convert to raw notes for backward compatibility
    const rawNotes = convertStructuredToRawNotes(merged)

    const metadata: MergeMetadata = {
      merged_at: new Date().toISOString(),
      had_manual_notes: existingNotes.notes_source === 'manual',
      sources_combined: [existingNotes.notes_source || 'unknown', 'auto'],
      ai_model_used: config.preferred_merge_model,
      merge_strategy: 'full'
    }

    console.log('✅ Notes merged successfully')

    return {
      structured_notes: merged,
      raw_notes: rawNotes,
      notes_source: 'merged',
      merge_metadata: metadata
    }

  } catch (error) {
    console.error('Merge failed:', error)
    // Fallback: return new notes
    return {
      structured_notes: newNotes.structured_notes,
      raw_notes: newNotes.raw_notes,
      notes_source: 'merged',
      merge_metadata: {
        merged_at: new Date().toISOString(),
        had_manual_notes: existingNotes.notes_source === 'manual',
        sources_combined: [existingNotes.notes_source || 'unknown', 'auto'],
        ai_model_used: 'fallback',
        merge_strategy: 'full'
      }
    }
  }
}

// ============================================
// Helper Functions
// ============================================

function formatNotesForMerge(notes: any): string {
  if (notes.structured_notes && typeof notes.structured_notes === 'object' && Object.keys(notes.structured_notes).length > 0) {
    return Object.entries(notes.structured_notes)
      .map(([section, items]) => {
        const sectionTitle = section.replace(/_/g, ' ').toUpperCase()
        return `${sectionTitle}:\n${(items as string[]).map(item => `• ${item}`).join('\n')}`
      })
      .join('\n\n')
  }

  if (notes.notes && Array.isArray(notes.notes)) {
    return notes.notes.join('\n')
  }

  if (notes.raw_notes && Array.isArray(notes.raw_notes)) {
    return notes.raw_notes.join('\n')
  }

  return 'No notes available'
}

function convertStructuredToRawNotes(structured: StructuredNotes): string[] {
  const notes: string[] = []

  const sections: Array<[string, keyof StructuredNotes]> = [
    ['New Features', 'new_features'],
    ['Changes', 'changes'],
    ['Improvements', 'improvements'],
    ['Bug Fixes', 'bug_fixes'],
    ['Known Issues', 'known_issues'],
    ['Notices', 'notices'],
    ['Compatibility', 'compatibility'],
    ['Upgrade Instructions', 'upgrade_instructions']
  ]

  for (const [title, key] of sections) {
    const items = structured[key]
    if (items && items.length > 0) {
      notes.push(`${title}:`)
      notes.push(...items.map(item => `• ${item}`))
      notes.push('') // Empty line between sections
    }
  }

  return notes.filter(Boolean)
}
