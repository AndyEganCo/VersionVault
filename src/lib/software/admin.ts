import { supabase } from '@/lib/supabase';
import type { Software } from './types';

type NewSoftware = {
  id: string;
  name: string;
  website: string;
};

export async function createSoftware(data: NewSoftware): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('software')
    .insert([{
      id: data.id,
      name: data.name,
      website: data.website,
      manufacturer: 'Unknown',
      category: 'Project Management',
      current_version: null,
      release_date: null,
      last_checked: null,
      created_at: now,
      updated_at: now,
      version_website: null
    }]);

  if (error) {
    console.error('Error creating software:', error);
    throw error;
  }
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