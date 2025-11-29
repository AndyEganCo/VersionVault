import OpenAI from 'openai';
import { scrapeWebsite } from '@/lib/ai/scraper';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ExtractedVersion {
  version: string;
  releaseDate: string;
  notes: string[];
  type: 'major' | 'minor' | 'patch';
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
1. Version number (e.g., "1.2.3", "v2.0", "2024.1")
2. Release date (convert to YYYY-MM-DD format)
3. List of changes/notes (each as a separate item)
4. Type of update (major, minor, or patch based on semantic versioning)

Return ONLY a valid JSON array with this exact structure:
[
  {
    "version": "1.2.3",
    "releaseDate": "2024-01-15",
    "notes": ["Feature 1", "Bug fix 2", "Improvement 3"],
    "type": "minor"
  }
]

Rules:
- Extract ALL versions found in the document, starting with the most recent
- If a date is not found, use "2024-01-01" as a placeholder
- Each note should be a concise bullet point
- Return empty array [] if no versions are found
- ONLY return the JSON array, no other text`
        },
        {
          role: "user",
          content: `Extract all version information from these release notes for ${softwareName}:\n\n${content.substring(0, 15000)}`
        }
      ],
      temperature: 0.1
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
