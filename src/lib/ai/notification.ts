import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

export async function notifyUsers(
  softwareId: string, 
  softwareName: string, 
  newVersion: string
): Promise<void> {
  const { data: trackers } = await supabase
    .from('tracked_software')
    .select('user_id')
    .eq('software_id', softwareId);

  if (!trackers) return;

  for (const tracker of trackers) {
    await supabase
      .from('notifications')
      .insert({
        user_id: tracker.user_id,
        software_id: softwareId,
        message: `New version ${newVersion} available for ${softwareName}`,
        type: 'version_update'
      });
  }
}