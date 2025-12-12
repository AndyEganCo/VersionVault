import { supabase } from '@/lib/supabase';
import type { Software } from '../types';

type NewSoftware = {
  id: string;
  name: string;
  website: string;
};

export async function createSoftware(data: NewSoftware): Promise<void> {
  const { error } = await supabase
    .from('software')
    .insert([{
      id: data.id,
      name: data.name,
      website: data.website,
      // Let the database handle defaults for other fields
      manufacturer: 'Unknown', // Will be updated by crawler
      category: 'Show Control', // Default category, will be updated by crawler
    }]);

  if (error) throw error;
}

export async function updateSoftware(id: string, data: Partial<Software>): Promise<void> {
  const { error } = await supabase
    .from('software')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSoftware(id: string): Promise<void> {
  // First, delete all version history for this software to avoid foreign key constraint
  const { error: versionError } = await supabase
    .from('software_version_history')
    .delete()
    .eq('software_id', id);

  if (versionError) {
    console.error('Error deleting version history:', {
      message: versionError.message,
      code: versionError.code,
      details: versionError.details,
    });
    throw versionError;
  }

  // Delete all tracked_software records for this software
  const { error: trackingError } = await supabase
    .from('tracked_software')
    .delete()
    .eq('software_id', id);

  if (trackingError) {
    console.error('Error deleting tracked software records:', {
      message: trackingError.message,
      code: trackingError.code,
      details: trackingError.details,
    });
    throw trackingError;
  }

  // Then delete the software itself
  const { error } = await supabase
    .from('software')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete software error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
}