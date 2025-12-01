import OpenAI from 'openai';

/**
 * ⚠️ SECURITY WARNING ⚠️
 * This file exposes the OpenAI API key client-side using dangerouslyAllowBrowser.
 * This is a SECURITY RISK - anyone can extract and abuse the API key from the browser.
 *
 * TODO: Move this logic to a Supabase Edge Function (server-side)
 * This file is DEPRECATED and should not be used for new features.
 * Use the secure server-side extract-software-info edge function instead.
 */

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // ⚠️ SECURITY RISK - API key exposed in browser
});

export async function extractVersion(softwareName: string, text: string): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a version detection specialist. Extract ONLY the version number from the provided text. Return ONLY the version number, nothing else. If no version is found, return null."
        },
        {
          role: "user",
          content: `Find the latest version number for ${softwareName} from this text: ${text.substring(0, 2000)}`
        }
      ]
    });

    const version = completion.choices[0].message.content;
    return version === 'null' ? null : version;
  } catch (error) {
    console.error(`Error extracting version for ${softwareName}:`, error);
    return null;
  }
}