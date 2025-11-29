import OpenAI from 'openai';
import { scrapeWebsite } from '@/lib/ai/scraper';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a release notes parser. Extract ALL version information from the provided release notes/changelog.

For each version, identify:
1. Version number (e.g., "1.2.3", "v2.0", "r32.1.3", "2024.1")
2. Release date (convert to YYYY-MM-DD format, if not found use today's date)
3. Build number (if present, e.g., "232426", "Full (Pro) build: 232426")
4. ALL release notes in Markdown format - preserve ALL structure and formatting:
   - Keep section headers (## Fixes, ## Features, ## New Features, etc.)
   - Keep issue IDs (DSOF-31635, NDI-1234, etc.)
   - Maintain bullet points and formatting
   - Include EVERYTHING - don't summarize or truncate
   - Use proper Markdown syntax (## for headers, - for bullets, ** for bold)
5. Type of update (major, minor, or patch based on semantic versioning)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "version": "r32.1.3",
    "releaseDate": "2025-11-29",
    "buildNumber": "232426",
    "notes": "## Fixes\\n- DSOF-31635 - Selecting a MIDI device...\\n- DSOF-31439 - Video is now correctly...\\n\\n## Features\\n- New feature here",
    "type": "minor"
  }
]

CRITICAL RULES:
- Extract ALL versions found in the document, from newest to oldest
- Include EVERY SINGLE release note - do NOT skip or summarize
- Preserve the EXACT formatting and structure from the original
- Keep ALL issue IDs, version numbers, build numbers
- Use Markdown format for notes (## for sections, - for bullets)
- If no date is found, use today's date in YYYY-MM-DD format
- Return empty array [] if no versions are found
- ONLY return the JSON array, no other text before or after`
        },
        {
          role: "user",
          content: `Extract ALL version information with COMPLETE release notes from these release notes for ${softwareName}. Do not summarize - include EVERY detail:\n\n${content.substring(0, 30000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 16000
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      return [];
    }

    // Try to parse the JSON response
    try {
      const versions = JSON.parse(response);
      return Array.isArray(versions) ? versions : [];
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', response);
      return [];
    }
  } catch (error) {
    console.error('Error extracting versions with AI:', error);
    throw error;
  }
}

/**
 * Extract versions from a URL
 */
export async function extractVersionsFromURL(softwareName: string, url: string): Promise<ExtractedVersion[]> {
  try {
    console.log(`Scraping release notes from ${url}...`);
    const content = await scrapeWebsite(url);

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
