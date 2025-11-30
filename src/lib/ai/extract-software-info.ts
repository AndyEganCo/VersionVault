import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, this should be server-side
});

export interface ExtractedSoftwareInfo {
  manufacturer: string;
  category: string;
  suggestedCurrentVersion?: string;
}

/**
 * Uses OpenAI to extract manufacturer and category information from software details
 */
export async function extractSoftwareInfo(
  name: string,
  website: string,
  versionUrl: string,
  description?: string
): Promise<ExtractedSoftwareInfo> {
  try {
    const prompt = `You are a software information expert. Given the following software details, extract:
1. The manufacturer/company name
2. The software category (choose EXACTLY from: Audio Production, Video Production, Presentation & Playback, Lighting Control, Show Control, Design & Planning, Network & Control, Project Management)

Software Details:
- Name: ${name}
- Website: ${website}
- Version URL: ${versionUrl}
${description ? `- Description: ${description}` : ''}

Respond in JSON format:
{
  "manufacturer": "Company Name",
  "category": "Category"
}

Guidelines:
- For manufacturer, extract from the website domain or use common knowledge
- For category, choose the EXACT category name from the list above (e.g., "Audio Production" not "Audio")
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
