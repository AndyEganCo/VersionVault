import { scrapeWebsite } from './scraper';
import { extractVersion } from './extractor';
import { saveVersionCheck } from '@/lib/api/version-check';
import { getSoftwareList } from '@/lib/software/api';
import type { CheckResult } from './types';
import { supabase } from '@/lib/supabase';

export async function checkVersion(url: string): Promise<CheckResult> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('http')) {
      throw new Error('Invalid URL protocol. Must be HTTP or HTTPS.');
    }

    // Get software from database instead of static list
    const allSoftware = await getSoftwareList();
    const software = allSoftware.find(s => s.website === url);
    const name = software?.name || 'Unknown Software';

    // Scrape website content
    const { content, source } = await scrapeWebsite(url);
    
    // Extract version and release date
    const { version, confidence, releaseDate } = await extractVersion(name, content, source);

    const result: CheckResult = {
      version,
      confidence: typeof confidence === 'string' ? 0.5 : confidence,
      source,
      softwareId: software?.id,
      timestamp: new Date().toISOString(),
      releaseDate
    };

    // Save check result
    await saveVersionCheck(url, result);

    // Update software if version changed
    if (software && version && version !== software.current_version) {
      await supabase
        .from('software')
        .update({ 
          current_version: version,
          last_checked: new Date().toISOString(),
          release_date: releaseDate || null  // Save release date
        })
        .eq('id', software.id);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    const result: CheckResult = {
      version: null,
      confidence: 0,
      source: 'error',
      error: errorMessage
    };

    // Save failed check
    await saveVersionCheck(url, result);
    
    return result;
  }
}

async function updateVersionCheckStats({ 
  newVersion = false, 
  success = false 
}) {
  const { data, error } = await supabase.rpc('update_version_check_stats', {
    new_version: newVersion,
    check_success: success
  });
  
  if (error) console.error('Error updating stats:', error);
  return data;
}