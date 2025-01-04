import { supabase } from '@/lib/supabase';
import type { Software } from './types';

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
  const { error } = await supabase
    .from('software')
    .delete()
    .eq('id', id);

  if (error) throw error;
}