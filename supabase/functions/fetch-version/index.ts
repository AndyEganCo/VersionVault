import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type VersionInfo = {
  version: string;
  build?: string;
  date?: string;
  isBeta?: boolean;
  notes?: string[];
}

async function fetchProPresenterVersions(): Promise<VersionInfo[]> {
  const apiUrl = 'https://api.renewedvision.com/api/v1/product/propresenter/versions'
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
    }
  })

  if (!response.ok) {
    throw new Error(`ProPresenter API request failed: ${response.status}`)
  }

  const data = await response.json()
  const versions: VersionInfo[] = []

  // Process stable version
  if (data.stable) {
    versions.push({
      version: data.stable.version,
      build: data.stable.build?.toString(),
      date: new Date(data.stable.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      isBeta: false,
      notes: data.stable.releaseNotes
    })
  }

  // Process beta version
  if (data.beta) {
    versions.push({
      version: data.beta.version,
      build: data.beta.build?.toString(),
      date: new Date(data.beta.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      isBeta: true,
      notes: data.beta.releaseNotes
    })
  }

  // Process previous versions
  if (Array.isArray(data.previous)) {
    for (const prev of data.previous) {
      versions.push({
        version: prev.version,
        build: prev.build?.toString(),
        date: new Date(prev.releaseDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        isBeta: false,
        notes: prev.releaseNotes
      })
    }
  }

  return versions
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let versions: VersionInfo[] = []

    // Check if it's a ProPresenter URL
    if (url.includes('renewedvision.com') || url.includes('propresenter')) {
      try {
        versions = await fetchProPresenterVersions()
      } catch (error) {
        console.error('ProPresenter API error:', error)
        throw new Error('Failed to fetch ProPresenter versions')
      }
    } else {
      throw new Error('Unsupported software URL')
    }

    // Sort versions by date (newest first)
    versions.sort((a, b) => {
      if (!a.date || !b.date) return 0
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return new Response(
      JSON.stringify({
        versions,
        currentVersion: versions.find(v => !v.isBeta),
        betaVersion: versions.find(v => v.isBeta),
        url
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Error in fetch-version:', error)
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        url: req.url,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
}) 