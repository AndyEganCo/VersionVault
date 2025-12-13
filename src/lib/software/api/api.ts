import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate } from '../types';
import { toast } from 'sonner';

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
}): Promise<boolean> {
  try {
    // First check if this version already exists
    const { data: existing } = await supabase
      .from('software_version_history')
      .select('id')
      .eq('software_id', softwareId)
      .eq('version', data.version)
      .maybeSingle();

    const notesArray = typeof data.notes === 'string'
      ? data.notes.split('\n').filter(Boolean)
      : (Array.isArray(data.notes) ? data.notes : []);

    if (existing) {
      // Update existing version - only update release_date if it's not null
      const updateData: any = {
        notes: notesArray,
        type: data.type
      };

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
      const { error } = await supabase
        .from('software_version_history')
        .insert({
          id: crypto.randomUUID(),
          software_id: data.software_id,
          version: data.version,
          previous_version: softwareData?.current_version || null,
          release_date: releaseDate,
          notes: notesArray,
          type: data.type,
          newsletter_verified: true,  // Auto-verify new versions for newsletters
          verified_at: now,
          detected_at: now,
          created_at: now
        });

      if (error) throw error;
    }

    // Update the software table with the new version info and last_checked
    const softwareUpdateData: any = {
      current_version: data.version,
      last_checked: new Date().toISOString()
    };

    // Only update release_date if a valid date is provided
    if (data.release_date && data.release_date !== 'null') {
      softwareUpdateData.release_date = data.release_date;
    }

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

/**
 * Compare two version strings (semantic versioning)
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim();
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim();

  // Split into parts (1.5.0 -> [1, 5, 0])
  const parts1 = clean1.split(/[.-]/).map(p => parseInt(p) || 0);
  const parts2 = clean2.split(/[.-]/).map(p => parseInt(p) || 0);

  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export async function getVersionHistory(softwareId: string) {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('id, version, notes, type, release_date, detected_at')
      .eq('software_id', softwareId);

    if (error) throw error;

    // Sort by version number (highest first) instead of date
    const sorted = (data || []).sort((a, b) => compareVersions(b.version, a.version));

    return sorted;
  });
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