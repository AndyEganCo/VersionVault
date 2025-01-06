import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const SYSTEM_PROMPT = `You are a version number extraction specialist. Your task is to find and return ONLY the latest version number from the provided text.

Rules:
1. Return ONLY the version number, nothing else
2. Return 'null' if no version number is found
3. Look for patterns like:
   - Semantic versioning (e.g., 1.2.3)
   - Simple versions (e.g., 2.1)
   - Version with build/revision (e.g., 1.2.3.4)
   - Version with prefix (e.g., v2.1.0)
4. Remove any 'v' prefix in the response
5. Ignore dates that might look like versions
6. Focus on the most recent/latest version number
7. Common version indicators:
   - "Version X.Y.Z"
   - "vX.Y.Z"
   - "Release X.Y.Z"
   - "Latest version: X.Y.Z"
   - "Current version: X.Y.Z"
   - "Download X.Y.Z"
   - "Version X.Y.Z is now available"
   - "X.Y.Z Release Notes"
   - "X.Y.Z Changelog"

Examples:
Input: "Download ProPresenter 7.13 now! Version 7.14 coming soon"
Output: 7.14

Input: "Current version: v2.1.0"
Output: 2.1.0

Input: "Latest release: Version 3.0.1-beta"
Output: 3.0.1`;

export async function extractVersion(
  softwareName: string, 
  content: string, 
  source: string
): Promise<{ 
  version: string | null; 
  confidence: 'high' | 'medium' | 'low';
  releaseDate?: string;
}> {
  try {
    const prompt = `Extract the latest version number for ${softwareName}.
Content source: ${source}
Text content: ${content.substring(0, 2000)}

Remember: Return ONLY the version number or 'null' if no version is found.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 20
    });

    const version = completion.choices[0].message.content?.trim() ?? null;
    
    // Determine confidence based on source and version format
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    if (source === 'meta' || source === 'version-element') {
      confidence = 'high';
    } else if (source === 'download-section' && version && /^\d+\.\d+(\.\d+)?$/.test(version)) {
      confidence = 'high';
    } else if (version && /^\d+\.\d+(\.\d+)?$/.test(version)) {
      confidence = 'medium';
    }

    // Look for release date in content
    const dateMatch = content.match(/released on (\d{4}-\d{2}-\d{2})|release date[:\s]+(\d{4}-\d{2}-\d{2})/i);
    const releaseDate = dateMatch ? dateMatch[1] || dateMatch[2] : undefined;

    return {
      version: version === 'null' ? null : version,
      confidence,
      releaseDate
    };
  } catch (error) {
    console.error('Version extraction error:', error);
    return { version: null, confidence: 'low' };
  }
}