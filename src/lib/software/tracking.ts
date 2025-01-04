import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { softwareList } from '@/data/software-list';

export async function getTrackedSoftware(userId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('tracked_software')
      .select('software_id')
      .eq('user_id', userId);

    if (error) throw error;

    // If no tracked software, track all by default
    if (!data?.length) {
      const softwareIds = softwareList.map(s => s.id);
      await trackAllSoftware(userId, softwareIds);
      return new Set(softwareIds);
    }

    return new Set(data.map(item => item.software_id));
  } catch (error) {
    console.error('Error fetching tracked software:', error);
    return new Set();
  }
}

export async function trackAllSoftware(userId: string, softwareIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('track_all_software', {
      p_user_id: userId,
      p_software_ids: softwareIds
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error tracking all software:', error);
    return false;
  }
}

export async function toggleSoftwareTracking(
  userId: string,
  softwareId: string,
  tracked: boolean
): Promise<boolean> {
  try {
    if (tracked) {
      // Use the safe tracking function
      const { error } = await supabase.rpc('track_software', {
        p_user_id: userId,
        p_software_id: softwareId
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tracked_software')
        .delete()
        .match({ user_id: userId, software_id: softwareId });
      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error updating software tracking:', error);
    toast.error(tracked ? 'Failed to track software' : 'Failed to untrack software');
    return false;
  }
}