import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate } from '../types';
import { toast } from 'sonner';
import { compareVersions } from '@/lib/utils/version-utils';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: Error | null;
}

async function handleDatabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  successMessage: string,
  errorMessage: string
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await operation();
    if (error) throw error;
    if (successMessage) toast.success(successMessage);
    return { data, error: null };
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    toast.error(errorMessage);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error(errorMessage) 
    };
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function getSoftwareList(): Promise<Software[]> {
  const { data } = await handleDatabaseOperation(
    async () => {
      const result = await supabase
        .from('software')
        .select('*')
        .order('name');
      return { data: result.data, error: result.error };
    },
    '',
    'Failed to load software list'
  );

  return data || [];
}

export async function updateSoftware(
  id: string, 
  updates: SoftwareUpdate
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .update(updates)
      .eq('id', id)
      .single();

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating software:', error);
    return false;
  }
}

export async function createSoftware(
  software: Omit<Software, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .insert(software);

    if (error) throw error;
    toast.success('Software added successfully');
    return true;
  } catch (error) {
    console.error('Failed to add software:', error);
    toast.error('Failed to add software');
    return false;
  }
}

export async function deleteSoftware(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .delete()
      .eq('id', id);

    if (error) throw error;
    toast.success('Software deleted successfully');
    return true;
  } catch (error) {
    console.error('Failed to delete software:', error);
    toast.error('Failed to delete software');
    return false;
  }
}

export async function addVersionHistory(softwareId: string, data: {
  software_id: string;
  version: string;
  release_date: string;
  notes: string;
  type: 'major' | 'minor' | 'patch';
  notes_source?: 'manual' | 'auto' | 'merged';
  structured_notes?: any;
  search_sources?: string[];
}): Promise<boolean> {
  try {
    // First check if this version already exists
    const { data: existing } = await supabase
      .from('software_version_history')
      .select('id, notes_source, notes, structured_notes, search_sources')
      .eq('software_id', softwareId)
      .eq('version', data.version)
      .maybeSingle();

    const notesArray = typeof data.notes === 'string'
      ? data.notes.split('\n').filter(Boolean)
      : (Array.isArray(data.notes) ? data.notes : []);

    if (existing) {
      // Check if existing notes have meaningful content
      const existingHasContent = existing.notes &&
        Array.isArray(existing.notes) &&
        existing.notes.length > 0 &&
        existing.notes.some(note => note && note.trim().length > 20); // At least 20 chars of content

      // ALWAYS merge when existing has content, to preserve quality information
      // The AI merge will intelligently decide what to keep/combine
      if (existingHasContent && data.notes_source === 'auto') {
        console.log('📝 Existing notes found, calling smart merge to preserve quality...');

        // Call merge edge function
        const mergeResult = await callMergeFunction(
          existing,
          {
            notes: notesArray,
            structured_notes: data.structured_notes || {} // Ensure we always pass an object
          }
        );

        if (mergeResult) {
          // Use merged result
          const updateData: any = {
            notes: mergeResult.raw_notes,
            structured_notes: mergeResult.structured_notes,
            notes_source: 'merged',
            merge_metadata: mergeResult.merge_metadata,
            notes_updated_at: new Date().toISOString(),
            type: data.type
          };

          if (data.release_date && data.release_date !== 'null') {
            updateData.release_date = data.release_date;
          }

          if (data.search_sources) {
            updateData.search_sources = data.search_sources;
          }

          const { error } = await supabase
            .from('software_version_history')
            .update(updateData)
            .eq('id', existing.id);

          if (error) throw error;
          console.log('✅ Notes merged successfully - quality preserved');
          return true;
        } else {
          console.log('⚠️ Merge failed, keeping existing notes');
          // Merge failed - keep existing notes instead of blindly overwriting
          return true;
        }
      }

      // Only overwrite if existing has no content OR new notes are manual
      // This prevents losing quality information
      const updateData: any = {
        notes: notesArray,
        type: data.type,
        notes_source: data.notes_source || 'auto',
        notes_updated_at: new Date().toISOString()
      };

      if (data.structured_notes) {
        updateData.structured_notes = data.structured_notes;
      }

      if (data.search_sources) {
        updateData.search_sources = data.search_sources;
      }

      // Only update release_date if a valid date is provided
      if (data.release_date && data.release_date !== 'null') {
        updateData.release_date = data.release_date;
      }

      const { error } = await supabase
        .from('software_version_history')
        .update(updateData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Get the current version from the software table to use as previous_version
      const { data: softwareData } = await supabase
        .from('software')
        .select('current_version')
        .eq('id', softwareId)
        .single();

      // Insert new version - use provided date or null if not available
      const releaseDate = (data.release_date && data.release_date !== 'null')
        ? data.release_date
        : null;

      const now = new Date().toISOString();
      const insertData: any = {
        id: crypto.randomUUID(),
        software_id: data.software_id,
        version: data.version,
        previous_version: softwareData?.current_version || null,
        release_date: releaseDate,
        notes: notesArray,
        type: data.type,
        notes_source: data.notes_source || 'auto',
        notes_updated_at: now,
        newsletter_verified: true,  // Auto-verify new versions for newsletters
        verified_at: now,
        detected_at: now,
        created_at: now
      };

      if (data.structured_notes) {
        insertData.structured_notes = data.structured_notes;
      }

      if (data.search_sources) {
        insertData.search_sources = data.search_sources;
      }

      const { error } = await supabase
        .from('software_version_history')
        .insert(insertData);

      if (error) throw error;
    }

    // Update the software table with last_checked timestamp
    // NOTE: We DO NOT update current_version here anymore.
    // Current version is now COMPUTED from software_version_history table
    // using semantic version comparison (highest version = current version).
    const softwareUpdateData: any = {
      last_checked: new Date().toISOString()
    };

    const { error: softwareError } = await supabase
      .from('software')
      .update(softwareUpdateData)
      .eq('id', softwareId);

    if (softwareError) throw softwareError;

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error adding version history:', error);
    console.error('Error details:', {
      softwareId,
      version: data.version,
      errorMessage
    });
    return false;
  }
}

export async function getVersionHistory(softwareId: string) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('id, version, notes, type, release_date, detected_at, notes_source, structured_notes, merge_metadata, search_sources, is_current_override, newsletter_verified')
      .eq('software_id', softwareId);

    if (error) throw error;

    // Sort by version number (highest first) instead of date
    const sorted = (data || []).sort((a, b) => compareVersions(b.version, a.version));

    return sorted;
  });
}

/**
 * Set a version as the current version (manual override)
 */
export async function setVersionAsCurrent(versionId: string, softwareId: string): Promise<boolean> {
  try {
    // Set is_current_override to true for this version
    // The database trigger will automatically set all other versions for this software to false
    const { error } = await supabase
      .from('software_version_history')
      .update({ is_current_override: true })
      .eq('id', versionId)
      .eq('software_id', softwareId); // Extra safety check

    if (error) throw error;

    toast.success('Version set as current');
    return true;
  } catch (error) {
    console.error('Error setting version as current:', error);
    toast.error('Failed to set version as current');
    return false;
  }
}

/**
 * Check if a version needs web search (hasn't been searched yet or has low quality notes)
 * Returns true if web search should be performed, false if we can skip it
 */
export async function shouldPerformWebSearch(
  softwareId: string,
  version: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('software_version_history')
      .select('search_sources, notes, structured_notes')
      .eq('software_id', softwareId)
      .eq('version', version)
      .maybeSingle();

    if (!existing) {
      // Version doesn't exist yet, definitely search
      return true;
    }

    // If we already have search sources with good coverage (10+ sources), skip search
    if (existing.search_sources && existing.search_sources.length >= 10) {
      console.log(`⏭️  Skipping web search for ${version} - already have ${existing.search_sources.length} sources`);
      return false;
    }

    // If we have structured notes with multiple sections, probably good enough
    if (existing.structured_notes &&
        typeof existing.structured_notes === 'object' &&
        Object.keys(existing.structured_notes).length >= 3) {
      console.log(`⏭️  Skipping web search for ${version} - already have ${Object.keys(existing.structured_notes).length} structured sections`);
      return false;
    }

    // If we have comprehensive raw notes (5+ lines), might be good enough
    if (existing.notes &&
        Array.isArray(existing.notes) &&
        existing.notes.length >= 5 &&
        !existing.notes.some(note => note.includes('No specific release notes'))) {
      console.log(`⏭️  Skipping web search for ${version} - already have ${existing.notes.length} detailed notes`);
      return false;
    }

    // Otherwise, do the search
    return true;
  } catch (error) {
    console.error('Error checking if web search needed:', error);
    // On error, default to searching to be safe
    return true;
  }
}

/**
 * Deletes a version history entry
 */
export async function deleteVersionHistory(versionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software_version_history')
      .delete()
      .eq('id', versionId);

    if (error) {
      console.error('Error deleting version history:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting version history:', error);
    return false;
  }
}

/**
 * Calls the merge edge function to intelligently combine existing and new notes
 */
async function callMergeFunction(
  existingNotes: { notes: string[], structured_notes?: any, notes_source?: string },
  newNotes: { notes: string[], structured_notes?: any }
): Promise<any | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/merge-release-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        existingNotes,
        newNotes
      })
    });

    if (!response.ok) {
      console.error('Merge function failed:', response.status);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling merge function:', error);
    return null;
  }
}