import { supabase } from '@/lib/supabase';
import { getReleaseNotesForVersion } from './scraper';

export async function storeVersionUpdate(
  softwareId: string,
  version: string,
  websiteUrl: string
): Promise<void> {
  try {
    // Get release notes
    const releaseNote = await getReleaseNotesForVersion(websiteUrl, version);
    
    // Store in database
    const { error } = await supabase
      .from('software_version_history')
      .insert({
        software_id: softwareId,
        version: version,
        notes: releaseNote.notes,
        type: releaseNote.type,
        detected_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error storing version update:', error);
  }
}