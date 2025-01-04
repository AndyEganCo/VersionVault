import { Software } from '@/data/software-list';
import { supabase } from './supabase';
import { toast } from 'sonner';

export async function getTrackedSoftware(userId: string): Promise<Set<string>> {
  try {
    // Check if Supabase is configured
    if (!supabase.auth.getSession()) {
      console.warn('Supabase not configured, using fallback data');
      return new Set();
    }

    const { data, error } = await supabase
      .from('tracked_software')
      .select('software_id')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return new Set(data?.map(item => item.software_id) || []);
  } catch (error) {
    console.error('Error fetching tracked software:', error);
    toast.error('Unable to load tracked software');
    return new Set();
  }
}

export async function toggleSoftwareTracking(
  userId: string,
  software: Software,
  tracked: boolean
): Promise<boolean> {
  try {
    // Check if Supabase is configured
    if (!supabase.auth.getSession()) {
      toast.error('Database connection not configured');
      return false;
    }

    if (tracked) {
      const { error } = await supabase
        .from('tracked_software')
        .insert([{ user_id: userId, software_id: software.id }]);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tracked_software')
        .delete()
        .eq('user_id', userId)
        .eq('software_id', software.id);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error tracking software:', error);
    toast.error(tracked ? 'Failed to track software' : 'Failed to untrack software');
    return false;
  }
}