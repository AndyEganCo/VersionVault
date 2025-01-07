import { ScrapeStatus } from '@/types/scrape';
import { scrapeWebsite } from './ai/scraper';
import { extractVersion } from './ai/version-extractor';
import { softwareList } from '@/data/software-list';
import { saveVersionCheck } from './api/version-check';
import type { ScrapeStatus, CheckResult } from './version-check/types';

export async function checkVersion(url: string): Promise<ScrapeStatus> {
  try {
    // Validate URL
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('http')) {
      throw new Error('Invalid URL protocol. Must be HTTP or HTTPS.');
    }

    // Find software by URL
    const software = softwareList.find(s => s.website === url);
    const name = software?.name || 'Unknown Software';

    // Scrape website content
    const content = await scrapeWebsite(url);
    if (!content) {
      throw new Error('No content found on page');
    }

    // Extract version
    const version = await extractVersion(name, content);
    if (!version) {
      return {
        success: false,
        version: null,
        content,
        softwareName: name,
        currentVersion: software?.currentVersion,
        error: 'Could not detect version number',
        source: 'error',
        confidence: 0
      };
    }

    const result: ScrapeStatus = {
      success: true,
      version,
      content,
      softwareName: name,
      currentVersion: software?.currentVersion,
      source: 'auto',
      confidence: 1
    };

    // Save check result
    await saveVersionCheck(url, result);
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    const result: ScrapeStatus = {
      success: false,
      version: null,
      content: '',
      error: errorMessage,
      source: 'error',
      confidence: 0
    };

    // Save failed check
    try {
      await saveVersionCheck(url, result);
    } catch (saveError) {
      console.error('Failed to save version check:', saveError);
      // Don't throw here to ensure we return the original error to the user
    }
    
    return result;
  }
}

// Add timestamp when converting ScrapeStatus to CheckResult
const result: CheckResult = {
  ...scrapeStatus,
  timestamp: scrapeStatus.checked_at
};