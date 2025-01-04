import { load } from 'cheerio';
import OpenAI from 'openai';
import type { ReleaseNote } from './types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

async function scrapeContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const html = await response.text();
    const $ = load(html);
    
    // Remove irrelevant content
    $('script, style, nav, footer, header').remove();
    
    // Look for common release notes containers
    const selectors = [
      '.release-notes',
      '.changelog',
      '#changelog',
      '[data-test="release-notes"]',
      '.releases',
      '.version-history'
    ];
    
    let content = '';
    selectors.forEach(selector => {
      const element = $(selector);
      if (element.length) {
        content += element.text() + '\n';
      }
    });
    
    return content || $('body').text();
  } catch (error) {
    console.error('Error scraping content:', error);
    return '';
  }
}

async function extractNotes(content: string, version: string): Promise<ReleaseNote> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Extract release notes for version ${version}. Return a JSON object with:
            - notes: array of bullet points describing changes
            - type: "major", "minor", or "patch" based on semantic versioning`
        },
        {
          role: "user",
          content: content
        }
      ]
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      version,
      date: new Date().toISOString(),
      notes: result.notes || ['No release notes available'],
      type: result.type || 'patch'
    };
  } catch (error) {
    console.error('Error extracting notes:', error);
    return {
      version,
      date: new Date().toISOString(),
      notes: ['No release notes available'],
      type: 'patch'
    };
  }
}

export async function getReleaseNotesForVersion(url: string, version: string): Promise<ReleaseNote> {
  const content = await scrapeContent(url);
  return extractNotes(content, version);
}