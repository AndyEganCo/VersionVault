import { supabase } from '@/lib/supabase';
import type { Software } from './types';

// Version patterns for different formats
const versionPatterns = [
  // Version with build number pattern (e.g., "VERSION 18 (301989919)")
  /VERSION\s*(\d+).*?\((\d+)\)/i,
  
  // Simple version number pattern (e.g., "Version 18")
  /version\s*(\d+(\.\d+)*)/i,
  
  // Build number pattern
  /\((\d{9})\)/,
  
  // Beta version pattern
  /BETA.*?(\d+(\.\d+)*)/i
];

type VersionInfo = {
  version: string;
  isBeta: boolean;
};

function extractVersionFromText(text: string): VersionInfo | null {
  for (const pattern of versionPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const isBeta = text.toLowerCase().includes('beta');
      console.log(`Found version ${match[1]} (Beta: ${isBeta}) using pattern: ${pattern}`);
      return {
        version: match[1],
        isBeta
      };
    }
  }
  return null;
}

export async function checkSoftwareVersion(software: Software): Promise<void> {
  console.log(`Checking version for ${software.name}...`);
  
  // Try download URL first if not already a download URL
  const urls = [software.website];
  if (!software.website.includes('/download')) {
    urls.push(software.website.replace(/\/?$/, '/download'));
  }

  let lastError = null;
  
  for (const url of urls) {
    try {
      const response = await retryWithBackoff(async () => {
        const { data, error } = await supabase.functions.invoke('fetch-version', {
          body: { url }
        });
        
        if (error) throw error;
        return data;
      }, 3);

      if (!response) {
        throw new Error('No response from version check');
      }

      // Try to extract version from response
      let versionInfo = null;
      if (response.version) {
        versionInfo = extractVersionFromText(response.version);
      }
      if (!versionInfo && response.rawText) {
        versionInfo = extractVersionFromText(response.rawText);
      }

      if (versionInfo) {
        const { version, isBeta } = versionInfo;
        const softwareName = isBeta ? `${software.name} - Beta` : software.name;

        // Only update if version is different and newer
        if (version !== software.current_version && isNewerVersion(version, software.current_version)) {
          console.log(`Updating ${softwareName} to version ${version}`);
          
          await updateSoftwareVersion(software.id, {
            name: softwareName,
            current_version: version,
            last_checked: new Date().toISOString()
          });

          // Store version history
          await recordVersionCheck(software.id, version, isBeta);
        } else {
          console.log(`No update needed for ${software.name}`);
          // Update last checked timestamp even if version hasn't changed
          await updateLastChecked(software.id);
        }
        return; // Exit if version found
      }
      
      lastError = new Error('Failed to parse version');
      
    } catch (error) {
      lastError = error;
      console.error(`Error checking version at ${url}:`, error);
      // Continue to next URL
    }
  }

  // If we get here, no version was found at any URL
  throw lastError || new Error('Failed to find version');
}

async function updateSoftwareVersion(id: string, data: Partial<Software>) {
  const { error, data: result } = await supabase
    .from('software')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

async function recordVersionCheck(softwareId: string, version: string, isBeta: boolean) {
  const { error } = await supabase
    .from('version_checks')
    .insert({
      software_id: softwareId,
      version,
      is_beta: isBeta,
      status: 'success',
      checked_at: new Date().toISOString()
    });

  if (error) throw error;
}

async function updateLastChecked(id: string) {
  const { error } = await supabase
    .from('software')
    .update({ last_checked: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

function isNewerVersion(newVersion: string, currentVersion: string | null | undefined): boolean {
  if (!currentVersion) return true;
  
  const newParts = newVersion.split('.').map(Number);
  const currentParts = currentVersion.split('.').map(Number);
  
  for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
    const newPart = newParts[i] || 0;
    const currentPart = currentParts[i] || 0;
    
    if (newPart > currentPart) return true;
    if (newPart < currentPart) return false;
  }
  
  return false;
}

export async function checkAllSoftwareVersions(): Promise<void> {
  const { data: software } = await supabase
    .from('software')
    .select('*');

  if (!software) return;

  console.log(`Checking versions for ${software.length} software items...`);
  for (const sw of software) {
    await checkSoftwareVersion(sw);
  }
}

// Helper function for retrying failed requests
async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  maxRetries: number, 
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
} 