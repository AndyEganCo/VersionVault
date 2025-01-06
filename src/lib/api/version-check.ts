import { supabase } from '../supabase';
import type { CheckResult } from '../version-check/types';

export async function saveVersionCheck(url: string, result: CheckResult) {
  const { error } = await supabase
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
      checked_at: result.timestamp || new Date().toISOString(),
      is_beta: false  // Default value
    });

  if (error) throw error;
}