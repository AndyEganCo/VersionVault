import { supabase } from '../supabase';
import type { VersionCheckResult } from '../version-check/types';

export async function saveVersionCheck(url: string, result: VersionCheckResult) {
  const timestamp = result.timestamp || new Date().toISOString();

  // Save the version check result
  const { error: checkError } = await supabase
    .from('version_checks')
    .insert({
      software_id: result.softwareId,
      url,
      detected_version: result.version,
      current_version: result.currentVersion,
      status: result.version ? 'success' : 'error',
      error: result.error,
      content: result.content,
      source: result.source,
      confidence: result.confidence,
      checked_at: timestamp,
      is_beta: false
    });

  if (checkError) throw checkError;

  // If version was detected successfully
  if (result.version) {
    // Check if this is a new version
    const isNewVersion = result.version !== result.currentVersion;

    if (isNewVersion && result.currentVersion) {
      // Update software table with new version
      const { error: softwareError } = await supabase
        .from('software')
        .update({
          current_version: result.version,
          release_date: timestamp,
          last_checked: timestamp
        })
        .eq('id', result.softwareId);

      if (softwareError) {
        console.error('Error updating software:', softwareError);
      }

      // Add to version history
      const { error: historyError } = await supabase
        .from('software_version_history')
        .insert({
          id: crypto.randomUUID(),
          software_id: result.softwareId,
          version: result.version,
          release_date: timestamp,
          notes: [`Version ${result.version} detected automatically via ${result.source || 'version check'}`],
          type: 'minor',
          created_at: timestamp
        });

      if (historyError) {
        console.error('Error adding version history:', historyError);
      }

      // Notify tracked users about the new version
      const { data: software } = await supabase
        .from('software')
        .select('name')
        .eq('id', result.softwareId)
        .single();

      if (software) {
        const { data: trackers } = await supabase
          .from('tracked_software')
          .select('user_id')
          .eq('software_id', result.softwareId);

        if (trackers && trackers.length > 0) {
          const notifications = trackers.map(tracker => ({
            user_id: tracker.user_id,
            software_id: result.softwareId,
            message: `New version ${result.version} available for ${software.name}`,
            type: 'version_update',
            created_at: timestamp
          }));

          await supabase
            .from('notifications')
            .insert(notifications);
        }
      }
    } else {
      // Just update last_checked timestamp
      await supabase
        .from('software')
        .update({ last_checked: timestamp })
        .eq('id', result.softwareId);
    }
  }
}