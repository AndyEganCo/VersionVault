import { load } from 'cheerio';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import type { Software } from './types';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

type VersionInfo = {
  version: string;
  isBeta: boolean;
};

function extractVersionFromText(text: string): VersionInfo | null {
  // Common version patterns, now including beta
  const patterns = [
    // Beta patterns first
    /version\s*(\d+\.\d+(\.\d+)?)\s*beta/i,           // Version 1.2.3 Beta
    /v(\d+\.\d+(\.\d+)?)\s*beta/i,                    // v1.2.3 Beta
    /(\d+\.\d+(\.\d+)?)\s*beta/i,                     // 1.2.3 Beta
    // Regular version patterns
    /version\s*(\d+\.\d+(\.\d+)?)/i,                  // Version 1.2.3
    /v(\d+\.\d+(\.\d+)?)/i,                          // v1.2.3
    /(\d+\.\d+(\.\d+)?)\s*release/i,                 // 1.2.3 Release
    /\b(\d+\.\d+(\.\d+)?)\b/                        // Bare version number
  ];

  for (const pattern of patterns) {
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

      console.log(`Edge function response for ${url}:`, response);
      
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

        console.log(`Found version ${version} for ${softwareName} (current: ${software.current_version})`);

        // Only update if version is different and newer
        if (version !== software.current_version && isNewerVersion(version, software.current_version)) {
          console.log(`Updating ${softwareName} to version ${version}`);
          
          const updateData = {
            name: softwareName,
            current_version: version,
            last_checked: new Date().toISOString()
          };

          console.log('Updating software with:', updateData);
          const { error: updateError, data: updateResult } = await supabase
            .from('software')
            .update(updateData)
            .eq('id', software.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating software:', updateError);
            throw updateError;
          }

          console.log('Software updated:', updateResult);

          // Store version history
          const { error: historyError, data: historyResult } = await supabase
            .from('version_checks')
            .insert({
              software_id: software.id,
              version,
              is_beta: isBeta,
              status: 'success',
              checked_at: new Date().toISOString()
            })
            .select()
            .single();

          if (historyError) {
            console.error('Error storing version history:', historyError);
            throw historyError;
          }

          console.log('Version history stored:', historyResult);
        } else {
          console.log(`No update needed for ${software.name}`);
          // Update last checked timestamp even if version hasn't changed
          const { error: updateError, data: updateResult } = await supabase
            .from('software')
            .update({ last_checked: new Date().toISOString() })
            .eq('id', software.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating last_checked:', updateError);
            throw updateError;
          }

          console.log('Last checked timestamp updated:', updateResult);
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