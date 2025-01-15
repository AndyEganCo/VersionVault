import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate } from './types';
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
          type: data.type
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
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    }

    // Update the software table with the new version info and last_checked
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
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('id, version, notes, type, release_date')
      .eq('software_id', softwareId)
      .order('release_date', { ascending: false });

    if (error) throw error;
    return data || [];
  });
}