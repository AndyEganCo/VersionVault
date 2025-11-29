import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const openaiApiKey = process.env.VITE_OPENAI_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface Software {
  id: string;
  name: string;
  version_website: string;
  current_version: string | null;
  manufacturer: string;
}

async function scrapeWebsite(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('script, style, noscript, iframe').remove();

    const metaVersion = $('meta[name*="version"], meta[property*="version"]').attr('content');
    if (metaVersion) return metaVersion;

    const versionElements = $('[class*="version"], [id*="version"], [data-version]');
    if (versionElements.length) return versionElements.first().text();

    const mainContent = $('main, article, .content, #content').text();
    return mainContent || $('body').text();
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw error;
  }
}

async function extractVersion(softwareName: string, text: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a version detection specialist. Extract ONLY the version number from the provided text. Return ONLY the version number, nothing else. If no version is found, return null.'
          },
          {
            role: 'user',
            content: `Find the latest version number for ${softwareName} from this text: ${text.substring(0, 2000)}`
          }
        ]
      })
    });

    const data = await response.json();
    const version = data.choices[0].message.content;
    return version === 'null' ? null : version?.trim() || null;
  } catch (error) {
    console.error(`Error extracting version for ${softwareName}:`, error);
    return null;
  }
}

async function checkSoftwareVersion(software: Software): Promise<{
  success: boolean;
  version: string | null;
  error?: string;
}> {
  try {
    console.log(`Checking version for ${software.name}...`);

    if (!software.version_website) {
      return { success: false, version: null, error: 'No version URL configured' };
    }

    const scrapedText = await scrapeWebsite(software.version_website);
    const detectedVersion = await extractVersion(software.name, scrapedText);

    if (!detectedVersion) {
      return { success: false, version: null, error: 'Could not detect version' };
    }

    // Check if version has changed
    if (detectedVersion !== software.current_version) {
      console.log(`New version detected for ${software.name}: ${detectedVersion}`);

      // Update the software table
      const { error: updateError } = await supabase
        .from('software')
        .update({
          current_version: detectedVersion,
          last_checked: new Date().toISOString(),
          release_date: new Date().toISOString()
        })
        .eq('id', software.id);

      if (updateError) {
        console.error(`Error updating ${software.name}:`, updateError);
        return { success: false, version: detectedVersion, error: updateError.message };
      }

      // Add to version history
      const { error: historyError } = await supabase
        .from('software_version_history')
        .insert({
          id: crypto.randomUUID(),
          software_id: software.id,
          version: detectedVersion,
          release_date: new Date().toISOString(),
          notes: ['Automatically detected new version'],
          type: 'minor',
          created_at: new Date().toISOString()
        });

      if (historyError) {
        console.error(`Error adding version history for ${software.name}:`, historyError);
      }

      return { success: true, version: detectedVersion };
    } else {
      // Just update last_checked
      await supabase
        .from('software')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', software.id);

      return { success: true, version: detectedVersion };
    }
  } catch (error) {
    console.error(`Error checking ${software.name}:`, error);
    return {
      success: false,
      version: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Starting automated version check...');

  // Verify cron secret for security (optional but recommended)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch all software with version URLs
    const { data: softwareList, error: fetchError } = await supabase
      .from('software')
      .select('id, name, version_website, current_version, manufacturer')
      .not('version_website', 'is', null);

    if (fetchError) {
      console.error('Error fetching software:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!softwareList || softwareList.length === 0) {
      console.log('No software found to check');
      return res.status(200).json({ message: 'No software to check' });
    }

    console.log(`Checking ${softwareList.length} software entries...`);

    const results = [];

    // Process in batches to avoid rate limits
    for (const software of softwareList) {
      const result = await checkSoftwareVersion(software as Software);
      results.push({
        name: software.name,
        ...result
      });

      // Wait 2 seconds between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const updated = results.filter(r => r.success && r.version).length;

    console.log(`Version check complete: ${successful} successful, ${failed} failed, ${updated} updated`);

    return res.status(200).json({
      success: true,
      checked: results.length,
      successful,
      failed,
      updated,
      results
    });
  } catch (error) {
    console.error('Fatal error in version checker:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
