import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Retry fetch with exponential backoff
async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
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
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i + 1) * 1000))
    }
  }
  throw new Error('All retry attempts failed')
}

// Extract links and text from HTML
function extractLinksAndContent(html: string, baseUrl: string): { links: string[], text: string } {
  // Simple link extraction (regex-based for Deno environment)
  const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi)
  const links: string[] = []

  for (const match of linkMatches) {
    try {
      const href = match[1]
      // Convert relative URLs to absolute
      const absoluteUrl = href.startsWith('http')
        ? href
        : new URL(href, baseUrl).toString()
      links.push(absoluteUrl)
    } catch (e) {
      // Skip invalid URLs
    }
  }

  // Remove HTML tags for text content
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { links: [...new Set(links)], text }
}

// Use OpenAI to find version or suggest where to look
async function intelligentVersionSearch(
  html: string,
  baseUrl: string,
  softwareName: string,
  openai: any
): Promise<{
  version: string | null
  suggestedUrls: string[]
  releaseNotes: string[]
  releaseDate: string | null
  updateType: 'major' | 'minor' | 'patch'
}> {

  const { links, text } = extractLinksAndContent(html, baseUrl)

  // Prepare a focused subset of links for OpenAI
  const relevantLinks = links
    .filter(link => {
      const lower = link.toLowerCase()
      return lower.includes('download') ||
             lower.includes('release') ||
             lower.includes('version') ||
             lower.includes('changelog') ||
             lower.includes('update')
    })
    .slice(0, 20) // Limit to avoid token limits

  console.log(`Found ${relevantLinks.length} potentially relevant links`)

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // gpt-4o supports JSON mode
      messages: [
        {
          role: 'system',
          content: `You are a web scraping expert helping to find software version information and release notes.

Your task: Extract comprehensive version information including release notes and dates.

Return ONLY a JSON object with this exact format:
{
  "version": "X.X.X" or null,
  "releaseDate": "YYYY-MM-DD" or null,
  "updateType": "major" or "minor" or "patch",
  "releaseNotes": ["note 1", "note 2", "note 3"],
  "suggestedUrls": ["url1", "url2"],
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}

Guidelines:
- Extract the LATEST/NEWEST version number
- Find the release date if mentioned (convert to YYYY-MM-DD format)
- Determine update type: major (X.0.0), minor (X.X.0), or patch (X.X.X)
- Extract 3-5 key release notes/changes/improvements as bullet points
- If version found but no notes, return generic description
- If not found, suggest URLs most likely to have this info`
        },
        {
          role: 'user',
          content: `Software: ${softwareName}
Website: ${baseUrl}

PAGE TEXT (first 5000 chars):
${text.substring(0, 5000)}

POTENTIALLY RELEVANT LINKS:
${relevantLinks.slice(0, 15).join('\n')}

Extract version, release date, release notes, and update type. Be thorough!`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    console.log(`OpenAI analysis: ${JSON.stringify(result)}`)

    return {
      version: result.version || null,
      suggestedUrls: result.suggestedUrls || [],
      releaseNotes: result.releaseNotes || [],
      releaseDate: result.releaseDate || null,
      updateType: result.updateType || 'minor'
    }
  } catch (error) {
    console.error('OpenAI analysis failed:', error)
    return {
      version: null,
      suggestedUrls: [],
      releaseNotes: [],
      releaseDate: null,
      updateType: 'minor'
    }
  }
}

// Extract version from GitHub API
function extractGitHubVersion(jsonResponse: any): string | null {
  try {
    if (jsonResponse.tag_name) {
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
      let releaseNotes: string[] = []
      let releaseDate: string | null = null
      let updateType: 'major' | 'minor' | 'patch' = 'minor'

      try {
        console.log(`\n=== Checking ${software.name} ===`)

        // Special handling for GitHub
        if (software.version_website.includes('github.com')) {
          try {
            const url = new URL(software.version_website)
            const pathParts = url.pathname.split('/').filter(Boolean)
            if (pathParts.length >= 2) {
              const [owner, repo] = pathParts
              const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
              console.log(`Trying GitHub API: ${apiUrl}`)

              const response = await fetchWithRetry(apiUrl)
              const json = JSON.parse(response)
              version = extractGitHubVersion(json)

              if (version) {
                successUrl = apiUrl
                // Extract release notes from GitHub API
                if (json.body) {
                  releaseNotes = json.body.split('\n').filter((line: string) => line.trim()).slice(0, 5)
                }
                if (json.published_at) {
                  releaseDate = json.published_at.split('T')[0]
                }
                console.log(`✓ Found version ${version} via GitHub API`)
              }
            }
          } catch (e) {
            console.log(`GitHub API failed: ${e.message}`)
          }
        }

        // If not found yet, use intelligent scraping
        if (!version) {
          try {
            console.log(`Fetching main page: ${software.version_website}`)
            const html = await fetchWithRetry(software.version_website)

            // First pass: analyze the main page
            const analysis = await intelligentVersionSearch(
              html,
              software.version_website,
              software.name,
              openai
            )

            if (analysis.version) {
              version = analysis.version
              successUrl = software.version_website
              releaseNotes = analysis.releaseNotes
              releaseDate = analysis.releaseDate
              updateType = analysis.updateType
              console.log(`✓ Found version ${version} on main page`)
            } else if (analysis.suggestedUrls.length > 0) {
              // Try the URLs OpenAI suggested
              console.log(`Trying ${analysis.suggestedUrls.length} suggested URLs...`)

              for (const suggestedUrl of analysis.suggestedUrls.slice(0, 3)) {
                try {
                  console.log(`Checking suggested URL: ${suggestedUrl}`)
                  const pageHtml = await fetchWithRetry(suggestedUrl)

                  const secondAnalysis = await intelligentVersionSearch(
                    pageHtml,
                    suggestedUrl,
                    software.name,
                    openai
                  )

                  if (secondAnalysis.version) {
                    version = secondAnalysis.version
                    successUrl = suggestedUrl
                    releaseNotes = secondAnalysis.releaseNotes
                    releaseDate = secondAnalysis.releaseDate
                    updateType = secondAnalysis.updateType
                    console.log(`✓ Found version ${version} at ${suggestedUrl}`)
                    break
                  }
                } catch (e) {
                  console.log(`Failed to check ${suggestedUrl}: ${e.message}`)
                  continue
                }
              }
            }
          } catch (error) {
            lastError = error.message
            console.error(`Main scraping failed: ${error.message}`)
          }
        }

        // Log the check result (version_checks table requires user_id, so we skip it for automated checks)
        console.log(`Check result for ${software.name}: ${version ? 'success' : 'error'} - ${version || lastError}`)

        // Update database if new version detected
        if (version && version !== software.current_version) {
          console.log(`🎉 New version for ${software.name}: ${version} (was ${software.current_version})`)

          // Use extracted release date or default to now
          const finalReleaseDate = releaseDate || new Date().toISOString().split('T')[0]

          // Ensure we have release notes
          const finalNotes = releaseNotes.length > 0
            ? releaseNotes
            : [`Version ${version} detected automatically from ${successUrl}`]

          await supabaseClient
            .from('software')
            .update({
              current_version: version,
              release_date: releaseDate ? `${releaseDate}T00:00:00.000Z` : new Date().toISOString(),
              last_checked: new Date().toISOString()
            })
            .eq('id', software.id)

          await supabaseClient
            .from('software_version_history')
            .insert({
              id: crypto.randomUUID(),
              software_id: software.id,
              version: version,
              release_date: `${finalReleaseDate}T00:00:00.000Z`,
              notes: finalNotes,
              type: updateType,
              created_at: new Date().toISOString()
            })

          // Notify tracking users
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
            error: lastError || 'Could not detect version'
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
