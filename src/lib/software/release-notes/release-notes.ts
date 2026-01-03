import { supabase } from '@/lib/supabase';
import type { ReleaseNote } from '../types';
import { formatDate } from '@/lib/date';

/**
 * Compare two version strings (semantic versioning)
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim();
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim();

  // Split into parts (1.5.0 -> [1, 5, 0])
  const parts1 = clean1.split(/[.-]/).map(p => parseInt(p) || 0);
  const parts2 = clean2.split(/[.-]/).map(p => parseInt(p) || 0);

  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

export async function getReleaseNotes(softwareId: string): Promise<ReleaseNote[]> {
  try {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, detected_at, notes, type')
      .eq('software_id', softwareId);

    if (error) throw error;

    const releaseNotes = data?.map(item => ({
      version: item.version,
      date: formatDate(item.detected_at),
      notes: item.notes || ['No release notes available'],
      type: item.type || 'patch'
    })) || [];

    // Sort by version number (newest first) instead of detected_at
    return releaseNotes.sort((a, b) => compareVersions(b.version, a.version));
  } catch (error) {
    console.error('Error fetching release notes:', error);
    return [];
  }
}