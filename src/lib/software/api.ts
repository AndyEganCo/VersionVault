import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate, VersionHistory } from './types';
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
  update: SoftwareUpdate
): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    async () => {
      // First update the software table
      const result = await supabase
        .from('software')
        .update(update)
        .eq('id', id);

      if (result.error) {
        throw result.error;
      }

      // If there's a current version, also update its last_checked in version history
      if (update.last_checked) {
        try {
          const { data: latestVersion, error: versionError } = await supabase
            .from('software_version_history')
            .select('id, version')
            .eq('software_id', id)
            .order('release_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (versionError) {
            console.error('Error fetching version history:', versionError);
          } else if (latestVersion) {
            const updateResult = await supabase
              .from('software_version_history')
              .update({ last_checked: update.last_checked })
              .eq('id', latestVersion.id);

            if (updateResult.error) {
              console.error('Error updating version history:', updateResult.error);
            }
          }
        } catch (err) {
          console.error('Error in version history update:', err);
        }
      }

      return { data: result.data, error: null };
    },
    'Software updated successfully',
    'Failed to update software'
  );

  return !error;
}

export async function createSoftware(
  software: Omit<Software, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .insert(software)
      .then(({ data, error }) => ({ data, error })),
    'Software added successfully',
    'Failed to add software'
  );

  return !error;
}

export async function deleteSoftware(id: string): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .delete()
      .eq('id', id)
      .then(({ data, error }) => ({ data, error })),
    'Software deleted successfully',
    'Failed to delete software'
  );

  return !error;
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
      .single();

    const notesArray = typeof data.notes === 'string' 
      ? data.notes.split('\n').filter(Boolean)
      : data.notes;

    if (existing) {
      // Update existing version
      const { error } = await supabase
        .from('software_version_history')
        .update({
          release_date: data.release_date,
          notes: notesArray,
          type: data.type,
          last_checked: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new version
      const { error } = await supabase
        .from('software_version_history')
        .insert({
          id: crypto.randomUUID(),
          software_id: data.software_id,
          version: data.version,
          release_date: data.release_date,
          notes: notesArray,
          type: data.type,
          created_at: new Date().toISOString(),
          last_checked: new Date().toISOString()
        });

      if (error) throw error;
    }

    // Update the software table
    const { error: softwareError } = await supabase
      .from('software')
      .update({
        current_version: data.version,
        release_date: data.release_date,
        last_checked: new Date().toISOString()
      })
      .eq('id', softwareId);

    if (softwareError) throw softwareError;

    return true;
  } catch (error) {
    console.error('Error adding version history:', error);
    return false;
  }
}

export async function getVersionHistory(softwareId: string) {
  const { data, error } = await supabase
    .from('software_version_history')
    .select('version, notes, type, release_date, last_checked')
    .eq('software_id', softwareId)
    .order('release_date', { ascending: false });

  if (error) {
    console.error('Error fetching version history:', error);
    throw error;
  }

  return data || [];
}