import { supabase } from '../supabase';
import type { CheckResult } from '../version-check/types';

export async function saveVersionCheck(url: string, result: CheckResult) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabase
      .from('version_checks')
      .insert({
        user_id: user.id,
        url,
        detected_version: result.version,
        current_version: result.currentVersion,
        status: result.success ? 'success' : 'error',
        error: result.error
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save version check:', error);
  }
}