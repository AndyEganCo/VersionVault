import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Retry fetch with exponential backoff
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.text()
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}: ${error.message}`)
      if (i === retries - 1) throw error
      // Exponential backoff: wait 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i + 1) * 1000))
    }
  }
  throw new Error('All retry attempts failed')
}

// Generate alternative URLs to try
function getAlternativeUrls(originalUrl: string, softwareName: string): string[] {
  const alternatives: string[] = []

  try {
    const url = new URL(originalUrl)
    const baseUrl = `${url.protocol}//${url.hostname}`

    // Common version page patterns
    alternatives.push(
      originalUrl,
      `${baseUrl}/download`,
      `${baseUrl}/downloads`,
      `${baseUrl}/releases`,
      `${baseUrl}/changelog`,
      `${baseUrl}/version`,
      `${baseUrl}/latest`,
    )

    // If it's a GitHub URL, try the releases API
    if (url.hostname.includes('github.com')) {
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        const [owner, repo] = pathParts
        alternatives.push(`https://api.github.com/repos/${owner}/${repo}/releases/latest`)
      }
    }
  } catch (e) {
    console.error('Error parsing URL:', e)
  }

  return alternatives
}

// Extract version from GitHub API response
function extractGitHubVersion(jsonResponse: any): string | null {
  try {
    if (jsonResponse.tag_name) {
      // Remove common prefixes like 'v', 'version-', 'release-'
      return jsonResponse.tag_name.replace(/^(v|version-|release-)/i, '')
    }
    if (jsonResponse.name) {
      return jsonResponse.name.replace(/^(v|version-|release-)/i, '')
    }
  } catch (e) {
    console.error('Error extracting GitHub version:', e)
  }
  return null
}

// Try to detect version from content
async function detectVersion(content: string, url: string, softwareName: string, openai: any): Promise<string | null> {
  // First, check if it's a GitHub API response
  if (url.includes('api.github.com')) {
    try {
      const json = JSON.parse(content)
      const version = extractGitHubVersion(json)
      if (version) {
        console.log(`Extracted version from GitHub API: ${version}`)
        return version
      }
    } catch (e) {
      console.log('Not a valid GitHub API response')
    }
  }

  // Use OpenAI to extract version from HTML/text
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a version detection specialist. Extract ONLY the latest version number from the provided text. Return ONLY the version number (e.g., "7.14.1" or "2024.1.0"), nothing else. If no version is found, return exactly the word "null".'
        },
        {
          role: 'user',
          content: `Find the latest version number for ${softwareName} from this text: ${content.substring(0, 3000)}`
        }
      ],
      temperature: 0.1,
    })

    const detectedVersion = completion.choices[0].message.content?.trim()
    if (detectedVersion && detectedVersion !== 'null' && detectedVersion.length > 0) {
      console.log(`OpenAI detected version: ${detectedVersion}`)
      return detectedVersion
    }
  } catch (error) {
    console.error('OpenAI extraction failed:', error)
  }

  return null
}

serve(async (req) => {
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

    const { data: softwareList, error: fetchError } = await supabaseClient
      .from('software')
      .select('id, name, version_website, current_version')
      .not('version_website', 'is', null)

    if (fetchError) throw fetchError

    const results = []

    for (const software of softwareList || []) {
      let version: string | null = null
      let successUrl: string | null = null
      let lastError: string | null = null

      try {
        console.log(`Checking version for ${software.name}...`)

        // Get list of alternative URLs to try
        const urlsToTry = getAlternativeUrls(software.version_website, software.name)

        // Try each URL until we find a version
        for (const url of urlsToTry) {
          try {
            console.log(`Trying URL: ${url}`)
            const content = await fetchWithRetry(url, 2)

            version = await detectVersion(content, url, software.name, openai)

            if (version) {
              successUrl = url
              console.log(`Successfully detected version ${version} from ${url}`)
              break
            }
          } catch (error) {
            console.log(`Failed to fetch ${url}: ${error.message}`)
            lastError = error.message
            continue // Try next URL
          }
        }

        // Save the version check result
        const { error: checkError } = await supabaseClient
          .from('version_checks')
          .insert({
            software_id: software.id,
            url: successUrl || software.version_website,
            detected_version: version,
            current_version: software.current_version,
            status: version ? 'success' : 'error',
            error: version ? null : (lastError || 'No version detected from any URL'),
            source: successUrl?.includes('api.github.com') ? 'github-api' : 'openai',
            confidence: version ? 0.9 : 0,
            checked_at: new Date().toISOString(),
            is_beta: false
          })

        if (checkError) {
          console.error(`Error saving check for ${software.name}:`, checkError)
        }

        // Update database if new version detected
        if (version && version !== software.current_version) {
          console.log(`New version for ${software.name}: ${version} (was ${software.current_version})`)

          await supabaseClient
            .from('software')
            .update({
              current_version: version,
              last_checked: new Date().toISOString()
            })
            .eq('id', software.id)

          await supabaseClient
            .from('software_version_history')
            .insert({
              id: crypto.randomUUID(),
              software_id: software.id,
              version: version,
              release_date: new Date().toISOString(),
              notes: [`Version ${version} detected automatically from ${successUrl}`],
              type: 'minor',
              created_at: new Date().toISOString()
            })

          // Send notifications to tracking users
          const { data: trackers } = await supabaseClient
            .from('tracked_software')
            .select('user_id')
            .eq('software_id', software.id)

          if (trackers && trackers.length > 0) {
            const notifications = trackers.map(t => ({
              user_id: t.user_id,
              software_id: software.id,
              message: `New version ${version} available for ${software.name}`,
              type: 'version_update',
              created_at: new Date().toISOString()
            }))
            await supabaseClient.from('notifications').insert(notifications)
          }

          results.push({
            software: software.name,
            oldVersion: software.current_version,
            newVersion: version,
            status: 'updated',
            url: successUrl
          })
        } else if (version) {
          await supabaseClient
            .from('software')
            .update({ last_checked: new Date().toISOString() })
            .eq('id', software.id)

          results.push({
            software: software.name,
            version: version,
            status: 'up-to-date',
            url: successUrl
          })
        } else {
          results.push({
            software: software.name,
            status: 'error',
            error: lastError || 'Could not detect version from any URL'
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
