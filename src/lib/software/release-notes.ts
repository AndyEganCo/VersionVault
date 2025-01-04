import { supabase } from '@/lib/supabase';
import type { ReleaseNote } from './types';

export async function getReleaseNotes(softwareId: string): Promise<ReleaseNote[]> {
  try {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, detected_at, notes, type')
      .eq('software_id', softwareId)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    return data?.map(item => ({
      version: item.version,
      date: new Date(item.detected_at).toLocaleDateString(),
      notes: item.notes || ['No release notes available'],
      type: item.type || 'patch'
    })) || [];
  } catch (error) {
    console.error('Error fetching release notes:', error);
    return [];
  }
}