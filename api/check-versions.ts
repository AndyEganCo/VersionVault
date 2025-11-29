import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Scrape website for version information
async function scrapeWebsite(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unnecessary elements
    $('script, style, noscript, iframe').remove();

    // Try to find version information in meta tags first
    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) {
      return metaVersion;
    }

    // Look for version information in specific elements
    const versionElements = $('[class*="version"], [id*="version"], [data-version], .version, #version');
    if (versionElements.length) {
      return versionElements.text();
    }

    // Get main content as fallback
    const mainContent = $('main, article, .content, #content').text();
    if (mainContent) {
      return mainContent.substring(0, 3000); // Limit content size
    }

    // Last resort: get body text
    const bodyText = $('body').text();
    if (!bodyText.trim()) {
      throw new Error('No content found on page');
    }

    return bodyText.substring(0, 3000); // Limit content size
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  }
}

// Extract version using OpenAI
async function extractVersion(softwareName: string, text: string): Promise<string | null> {
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

// Check version for a single software item
async function checkSoftwareVersion(software: any) {
  try {
    console.log(`Checking version for ${software.name}...`);

    // Skip if no version page URL
    if (!software.version_page_url) {
      console.log(`No version page URL for ${software.name}, skipping`);
      return {
        software_id: software.id,
        name: software.name,
        status: 'skipped',
        reason: 'no_url'
      };
    }

    // Scrape the version page
    const content = await scrapeWebsite(software.version_page_url);

    // Extract version using AI
    const detectedVersion = await extractVersion(software.name, content);

    if (!detectedVersion) {
      // Save error check
      await supabase.from('version_checks').insert({
        software_id: software.id,
        url: software.version_page_url,
        detected_version: null,
        current_version: software.current_version,
        status: 'error',
        error: 'Failed to detect version',
        content: content.substring(0, 500),
        checked_at: new Date().toISOString()
      });

      return {
        software_id: software.id,
        name: software.name,
        status: 'error',
        error: 'Failed to detect version'
      };
    }

    // Save successful check
    await supabase.from('version_checks').insert({
      software_id: software.id,
      url: software.version_page_url,
      detected_version: detectedVersion,
      current_version: software.current_version,
      status: 'success',
      content: content.substring(0, 500),
      checked_at: new Date().toISOString()
    });

    // Check if version is different
    const isNewVersion = detectedVersion !== software.current_version;

    if (isNewVersion) {
      console.log(`New version detected for ${software.name}: ${detectedVersion} (was ${software.current_version})`);

      // Update software table with last_checked
      await supabase
        .from('software')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', software.id);
    }

    return {
      software_id: software.id,
      name: software.name,
      status: 'success',
      detected_version: detectedVersion,
      current_version: software.current_version,
      is_new_version: isNewVersion
    };
  } catch (error) {
    console.error(`Error checking ${software.name}:`, error);

    // Save error check
    await supabase.from('version_checks').insert({
      software_id: software.id,
      url: software.version_page_url,
      detected_version: null,
      current_version: software.current_version,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      checked_at: new Date().toISOString()
    });

    return {
      software_id: software.id,
      name: software.name,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify the request is authorized (check for cron secret or authorization header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting nightly version checks...');

    // Fetch all software items
    const { data: softwareList, error: fetchError } = await supabase
      .from('software')
      .select('*')
      .order('name');

    if (fetchError) {
      console.error('Error fetching software:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch software list',
        details: fetchError.message
      });
    }

    if (!softwareList || softwareList.length === 0) {
      return res.status(200).json({
        message: 'No software to check',
        results: []
      });
    }

    console.log(`Found ${softwareList.length} software items to check`);

    // Check versions for all software (with some rate limiting)
    const results = [];
    for (const software of softwareList) {
      const result = await checkSoftwareVersion(software);
      results.push(result);

      // Add a small delay between checks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const summary = {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      newVersions: results.filter(r => r.is_new_version).length
    };

    console.log('Version check summary:', summary);

    return res.status(200).json({
      message: 'Nightly version check completed',
      summary,
      results
    });
  } catch (error) {
    console.error('Error in version check handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
