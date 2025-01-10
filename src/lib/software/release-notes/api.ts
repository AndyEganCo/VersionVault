import { supabase } from '@/lib/supabase';
import type { ReleaseNote } from './types';

export async function getReleaseNotes(softwareId: string): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('software_id', softwareId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching release notes:', error);
    return [];
  }

  return data || [];
} 