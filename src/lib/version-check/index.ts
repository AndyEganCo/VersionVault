import { scrapeWebsite } from './scraper';
import { extractVersion } from './extractor';
import { saveVersionCheck } from '@/lib/api/version-check';
import { softwareList } from '@/data/software-list';
import type { CheckResult } from './types';

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
    const { content, source } = await scrapeWebsite(url);
    
    // Extract version
    const { version, confidence } = await extractVersion(name, content, source);

    const result: CheckResult = {
      success: version !== null,
      version,
      confidence,
      source,
      content: `Source: ${source}\nConfidence: ${confidence}`,
      softwareName: name,
      currentVersion: software?.currentVersion
    };

    // Save check result
    await saveVersionCheck(url, result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    const result: CheckResult = {
      success: false,
      version: null,
      confidence: 'low',
      source: 'error',
      content: `Error: ${errorMessage}`,
      error: errorMessage
    };

    // Save failed check
    await saveVersionCheck(url, result);
    
    return result;
  }
}