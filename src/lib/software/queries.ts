import { supabase } from '@/lib/supabase';
import { softwareList } from '@/data/software-list';
import type { Software } from './types';

export async function getAllSoftware(): Promise<Software[]> {
  try {
    // Get tracked software IDs for logged-in users
    const { data: { session } } = await supabase.auth.getSession();
    const { data: tracked } = session ? await supabase
      .from('tracked_software')
      .select('software_id')
      .eq('user_id', session.user.id) : { data: null };

    const trackedIds = new Set(tracked?.map(t => t.software_id) || []);

    // Map software list with tracked status
    return softwareList.map(s => ({
      ...s,
      tracked: trackedIds.has(s.id)
    }));
  } catch (error) {
    console.error('Error fetching software:', error);
    return softwareList.map(s => ({ ...s, tracked: true }));
  }
}