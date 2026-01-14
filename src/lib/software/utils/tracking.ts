import { supabase } from '@/lib/supabase';

export async function getTrackedSoftware(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('tracked_software')
    .select('software_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching tracked software:', error);
    throw error;
  }

  return new Set(data.map(row => row.software_id));
}

export async function toggleSoftwareTracking(
  userId: string,
  softwareId: string,
  isTracking: boolean
): Promise<boolean> {
  try {
    if (isTracking) {
      // Get current user to check if tracking for self or someone else
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // If admin tracking for another user, use RPC function
      if (currentUserId && currentUserId !== userId) {
        const { data, error } = await supabase.rpc('admin_track_software_for_user', {
          p_user_id: userId,
          p_software_id: softwareId
        });

        if (error) throw error;
        return data === true;
      }

      // Otherwise use direct upsert (user tracking for themselves)
      const { error } = await supabase
        .from('tracked_software')
        .upsert({
          id: crypto.randomUUID(),
          user_id: userId,
          software_id: softwareId,
          created_at: new Date().toISOString()
        });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tracked_software')
        .delete()
        .eq('user_id', userId)
        .eq('software_id', softwareId);
      if (error) throw error;
    }
    return true;
  } catch (error) {
    console.error('Error toggling software tracking:', error);
    return false;
  }
}