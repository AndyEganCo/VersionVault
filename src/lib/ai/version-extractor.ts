import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
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