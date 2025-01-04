import { supabase } from '@/lib/supabase';
import { getReleaseNotesForVersion } from './scraper';
import { determineVersionType } from './utils';

export async function storeVersionUpdate(
  softwareId: string,
  oldVersion: string | null,
  newVersion: string,
  websiteUrl: string
): Promise<void> {
  try {
    const releaseNote = await getReleaseNotesForVersion(websiteUrl, newVersion);
    
    // Determine version type
    const type = oldVersion 
      ? determineVersionType(oldVersion, newVersion)
      : releaseNote.type;
    
    const { error } = await supabase
      .from('software_version_history')
      .insert({
        software_id: softwareId,
        version: newVersion,
        notes: releaseNote.notes,
        type,
        detected_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error storing version update:', error);
  }
}