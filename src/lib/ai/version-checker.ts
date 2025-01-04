import { Software } from '@/data/software-list';
import { scrapeWebsite } from './scraper';
import { extractVersion } from './version-extractor';
import { storeVersion } from './version-storage';
import { notifyUsers } from './notification';

export async function checkSoftwareVersion(software: Software) {
  try {
    const pageText = await scrapeWebsite(software.website);
    const detectedVersion = await extractVersion(software.name, pageText);

    if (detectedVersion && detectedVersion !== software.currentVersion) {
      await storeVersion(software.id, detectedVersion);
      await notifyUsers(software.id, software.name, detectedVersion);
    }

    return detectedVersion;
  } catch (error) {
    console.error(`Error checking version for ${software.name}:`, error);
    return null;
  }
}