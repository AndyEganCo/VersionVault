import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { load } from 'https://esm.sh/cheerio@1.0.0-rc.12'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Edge Function: fetch-version loaded');

function extractVersionFromText(text: string): string | null {
  // Common version patterns
  const patterns = [
    // Beta patterns first
    /version\s*(\d+\.\d+(\.\d+)?)\s*beta/i,           // Version 1.2.3 Beta
    /v(\d+\.\d+(\.\d+)?)\s*beta/i,                    // v1.2.3 Beta
    /(\d+\.\d+(\.\d+)?)\s*beta/i,                     // 1.2.3 Beta
    // Regular version patterns
    /version\s*(\d+\.\d+(\.\d+)?)/i,                  // Version 1.2.3
    /v(\d+\.\d+(\.\d+)?)/i,                          // v1.2.3
    /(\d+\.\d+(\.\d+)?)\s*release/i,                 // 1.2.3 Release
    /download.*?(\d+\.\d+(\.\d+)?)/i,                // Download 1.2.3
    /current.*?(\d+\.\d+(\.\d+)?)/i,                 // Current 1.2.3
    /latest.*?(\d+\.\d+(\.\d+)?)/i,                  // Latest 1.2.3
    /propresenter.*?(\d+\.\d+(\.\d+)?)/i,            // ProPresenter 1.2.3
    /\b(\d+\.\d+(\.\d+)?)\b/                        // Bare version number
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      console.log(`Found version ${match[1]} using pattern: ${pattern}`);
      return match[1];
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    console.log('Fetching URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'follow',
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);
    
    // Remove irrelevant content
    $('script, style, noscript, iframe').remove();
    
    // First try specific selectors
    const selectors = [
      '[data-version]',
      '.version',
      '.current-version',
      '#version',
      'meta[name="version"]',
      'span:contains("Version")',
      'div:contains("Version")',
      'div:contains("ProPresenter")',
      'h1:contains("ProPresenter")',
      'h2:contains("ProPresenter")',
      'h3:contains("ProPresenter")',
      'p:contains("ProPresenter")',
      'a:contains("Download")',
      '.download-button',
      'h1:contains("Version")',
      'h2:contains("Version")',
      'h3:contains("Version")',
      'p:contains("Version")',
      '.release-version',
      '[class*="version"]',
      '[id*="version"]'
    ];
    
    let foundVersion = null;
    let rawText = '';
    let debugInfo = [];
    
    // First try specific selectors
    for (const selector of selectors) {
      const elements = $(selector);
      elements.each((_, el) => {
        const text = $(el).text().trim();
        debugInfo.push(`${selector}: ${text}`);
        const version = extractVersionFromText(text);
        if (version) {
          foundVersion = version;
          rawText = text;
          return false; // break the loop
        }
      });
      if (foundVersion) break;
    }
    
    // If no version found, try scanning the whole page
    if (!foundVersion) {
      const bodyText = $('body').text();
      foundVersion = extractVersionFromText(bodyText);
      rawText = bodyText;
      debugInfo.push('body: ' + bodyText.substring(0, 500) + '...');
    }
    
    console.log('Final extracted version:', foundVersion);
    
    return new Response(
      JSON.stringify({ 
        version: foundVersion,
        rawText,
        debug: {
          url,
          responseStatus: response.status,
          htmlLength: html.length,
          foundVersion: foundVersion !== null,
          selectorResults: debugInfo,
          fullHtml: html.substring(0, 1000) + '...' // First 1000 chars for debugging
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Error in fetch-version:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}); 