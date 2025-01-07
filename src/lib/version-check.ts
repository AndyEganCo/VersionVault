import { scrapeWebsite } from './ai/scraper';
import { extractVersion } from './ai/version-extractor';
import { softwareList } from '@/data/software-list';
import { saveVersionCheck } from './api/version-check';
import type { CheckResult } from './version-check/types';

export type ScrapeResult = {
  success: boolean;
  version: string | null;
  content: string;
  error?: string;
  source: string;
  confidence: number;
  timestamp: string;
};

export async function checkVersion(url: string): Promise<CheckResult> {
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

    const result: CheckResult = {
      version,
      confidence: 1,
      source: 'auto',
      timestamp: new Date().toISOString(),
      content
    };

    await saveVersionCheck(url, result);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    const result: CheckResult = {
      version: null,
      confidence: 0,
      source: 'error',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      content: ''
    };

    await saveVersionCheck(url, result);
    return result;
  }
}