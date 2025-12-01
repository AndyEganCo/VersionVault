import OpenAI from 'openai';

/**
 * ⚠️ SECURITY WARNING ⚠️
 * This file exposes the OpenAI API key client-side using dangerouslyAllowBrowser.
 * This is a SECURITY RISK - anyone can extract and abuse the API key from the browser.
 *
 * TODO: Move release notes extraction to a Supabase Edge Function (server-side)
 * For now, this is still in use but should be migrated to server-side processing.
 */

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // ⚠️ SECURITY RISK - API key exposed in browser
});

export interface ExtractedVersion {
  version: string;
  releaseDate: string;
  notes: string; // Now stores Markdown-formatted text
  type: 'major' | 'minor' | 'patch';
  buildNumber?: string;
}

/**
 * Extract version history from text content using OpenAI
 */
async function extractVersionsFromText(softwareName: string, content: string): Promise<ExtractedVersion[]> {
  try {
    // Log the content being processed for debugging
    console.log('=== CONTENT BEING PROCESSED ===');
    console.log('Software:', softwareName);
    console.log('Content length:', content.length);
    console.log('First 500 chars:', content.substring(0, 500));
    console.log('===============================');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o which has 128k context window
      messages: [
        {
          role: "system",
          content: `You are a release notes parser. Your job is to extract EVERY SINGLE VERSION found in the provided text.

IMPORTANT: Extract ALL versions present in the document, not just new ones. Include historical versions, current versions, and any version mentioned.

For each version found, extract:
1. Version number (e.g., "1.2.3", "v2.0", "r32.1.3", "2024.1", "6.2.1")
2. Release date (convert to YYYY-MM-DD format, if not found use "2024-01-01")
3. Build number (if present, e.g., "232426", "Full (Pro) build: 232426")
4. ALL release notes in Markdown format:
   - Keep section headers (## Fixes, ## Features, ## New Features, ## Fixed, etc.)
   - Keep issue IDs (DSOF-31635, NDI-1234, etc.)
   - Keep bullet points and lists
   - Include EVERYTHING - don't summarize
   - Use Markdown: ## for headers, - for bullets, ** for bold
5. Type: "major" for X.0.0, "minor" for X.X.0, "patch" for X.X.X

Return ONLY valid JSON with this structure:
[
  {
    "version": "r32.1.3",
    "releaseDate": "2025-11-29",
    "buildNumber": "232426",
    "notes": "## Fixes\\n- Issue fix here\\n- Another fix\\n\\n## Features\\n- New feature",
    "type": "minor"
  }
]

CRITICAL RULES:
- Extract EVERY version in the document (not just recent ones)
- If you see "version 1.0", "v2.3", "release 3.4.5" - extract ALL of them
- Preserve exact formatting from source
- Keep ALL issue IDs and details
- If no clear date, use "2024-01-01"
- Return [] if NO versions found
- ONLY return JSON, no extra text`
        },
        {
          role: "user",
          content: `Extract EVERY SINGLE VERSION from these ${softwareName} release notes. Include all versions mentioned, not just the latest:\n\n${content.substring(0, 50000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 16000  // GPT-4o supports up to 16k output tokens for comprehensive release notes
    });

    let response = completion.choices[0].message.content;
    console.log('=== AI RESPONSE ===');
    console.log(response);
    console.log('===================');

    if (!response) {
      return [];
    }

    // Remove markdown code blocks if present
    // Sometimes AI wraps JSON in ```json ... ```
    response = response.trim();
    if (response.startsWith('```json')) {
      response = response.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    } else if (response.startsWith('```')) {
      response = response.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    response = response.trim();

    // Try to parse the JSON response
    try {
      const versions = JSON.parse(response);
      console.log('Parsed versions:', versions.length);
      return Array.isArray(versions) ? versions : [];
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON. Response was:', response);
      console.error('Parse error:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error extracting versions with AI:', error);
    throw error;
  }
}

/**
 * Extract versions from a URL using Supabase Edge Function
 */
export async function extractVersionsFromURL(softwareName: string, url: string): Promise<ExtractedVersion[]> {
  try {
    console.log(`Fetching release notes from ${url} via Edge Function...`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fetch-webpage`;

    // Call Supabase Edge Function to avoid CORS issues
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Edge function error! status: ${response.status}`);
    }

    const { content, error } = await response.json();

    if (error) {
      throw new Error(error);
    }

    if (!content || content.trim().length === 0) {
      throw new Error('No content found at URL');
    }

    console.log(`Extracted ${content.length} characters, processing with AI...`);
    const versions = await extractVersionsFromText(softwareName, content);

    console.log(`Extracted ${versions.length} versions`);
    return versions;
  } catch (error) {
    console.error('Error extracting versions from URL:', error);
    throw error;
  }
}

/**
 * Extract versions from PDF text content
 */
export async function extractVersionsFromPDF(softwareName: string, pdfText: string): Promise<ExtractedVersion[]> {
  try {
    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error('PDF content is empty');
    }

    console.log(`Processing PDF content (${pdfText.length} characters) with AI...`);
    const versions = await extractVersionsFromText(softwareName, pdfText);

    console.log(`Extracted ${versions.length} versions from PDF`);
    return versions;
  } catch (error) {
    console.error('Error extracting versions from PDF:', error);
    throw error;
  }
}
