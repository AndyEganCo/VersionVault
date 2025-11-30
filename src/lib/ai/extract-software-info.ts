import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, this should be server-side
});

export interface ExtractedSoftwareInfo {
  manufacturer: string;
  category: string;
  currentVersion?: string;
  releaseDate?: string;
}

/**
 * Fetches webpage content for version extraction using Supabase Edge Function
 * This bypasses CORS restrictions by fetching server-side
 */
async function fetchWebpageContent(url: string): Promise<string> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured, skipping webpage fetch');
      return '';
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch-webpage`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`Edge function error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.content || '';
  } catch (error) {
    console.error('Error fetching webpage:', error);
    return '';
  }
}

/**
 * Uses OpenAI to extract manufacturer, category, and version information from software details
 */
export async function extractSoftwareInfo(
  name: string,
  website: string,
  versionUrl: string,
  description?: string
): Promise<ExtractedSoftwareInfo> {
  try {
    // Fetch version webpage content
    const versionPageContent = await fetchWebpageContent(versionUrl);

    const prompt = `You are a software information expert. Given the following software details, extract:
1. The manufacturer/company name
2. The software category (choose EXACTLY from: Audio Production, Video Production, Presentation & Playback, Lighting Control, Show Control, Design & Planning, Network & Control, Project Management)
3. The current version number (if available from the version page)
4. The release date of the current version (if available, format as YYYY-MM-DD)

Software Details:
- Name: ${name}
- Website: ${website}
- Version URL: ${versionUrl}
${description ? `- Description: ${description}` : ''}

Version Page Content (first 3000 chars):
${versionPageContent || 'No content available'}

Respond in JSON format:
{
  "manufacturer": "Company Name",
  "category": "Category",
  "currentVersion": "version number or null",
  "releaseDate": "YYYY-MM-DD or null"
}

Guidelines:
- For manufacturer, extract from the website domain or use common knowledge
- For category, choose the EXACT category name from the list above (e.g., "Audio Production" not "Audio")
- For currentVersion, look for version numbers in the content (e.g., "v2.1.3", "2024.1", "8.5.2")
- For releaseDate, look for dates associated with the latest version, format as YYYY-MM-DD
- If version or date cannot be determined, use null
- If uncertain about category, default to "Show Control"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts software information and returns only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const extracted = JSON.parse(response) as ExtractedSoftwareInfo;

    // Validate the response
    if (!extracted.manufacturer || !extracted.category) {
      throw new Error('Invalid response from AI');
    }

    // Clean up null values
    if (extracted.currentVersion === null || extracted.currentVersion === 'null') {
      delete extracted.currentVersion;
    }
    if (extracted.releaseDate === null || extracted.releaseDate === 'null') {
      delete extracted.releaseDate;
    }

    return extracted;
  } catch (error) {
    console.error('Error extracting software info with AI:', error);

    // Fallback: extract from domain name
    const fallback = extractFromDomain(website);
    return fallback;
  }
}

/**
 * Fallback method to extract info from domain if AI fails
 */
function extractFromDomain(website: string): ExtractedSoftwareInfo {
  try {
    const url = new URL(website);
    const domain = url.hostname.replace('www.', '');
    const parts = domain.split('.');

    // Extract manufacturer from domain
    let manufacturer = parts[0];
    manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);

    return {
      manufacturer,
      category: 'Show Control' // Default category
    };
  } catch {
    return {
      manufacturer: 'Unknown',
      category: 'Show Control'
    };
  }
}
