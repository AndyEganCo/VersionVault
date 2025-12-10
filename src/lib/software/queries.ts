import { supabase } from '@/lib/supabase';
import type { Software } from './types';

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

export async function getAllSoftwareWithVersions(): Promise<Software[]> {
  // First get all software
  const { data: softwareData, error: softwareError } = await supabase
    .from('software')
    .select('*')
    .order('name');

  if (softwareError) {
    console.error('Error fetching software:', softwareError);
    throw new Error('Failed to fetch software');
  }

  // Then get latest version for each software
  const softwareWithVersions = await Promise.all(
    softwareData.map(async (software) => {
      // Fetch ALL versions and sort by version number (not date)
      const { data: allVersions } = await supabase
        .from('software_version_history')
        .select('version, notes, type, release_date, detected_at')
        .eq('software_id', software.id);

      // Sort by version number to get the true latest version
      const sortedVersions = (allVersions || []).sort((a, b) => compareVersions(b.version, a.version));
      const versionHistory = sortedVersions[0];

      return {
        ...software,
        current_version: versionHistory?.version || software.current_version,
        release_date: versionHistory?.release_date || versionHistory?.detected_at || software.release_date,
        release_notes: versionHistory ? [{
          version: versionHistory.version,
          date: versionHistory.release_date || versionHistory.detected_at,
          notes: Array.isArray(versionHistory.notes) ? versionHistory.notes : [versionHistory.notes],
          type: versionHistory.type
        }] : []
      };
    })
  );

  return softwareWithVersions;
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('software')
    .select('category')
    .order('category');

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }

  // Get unique categories
  const categories = [...new Set(data.map(s => s.category))];
  return categories;
}

export async function getLatestVersionInfo(softwareId: string): Promise<{
  version: string | null;
  notes: string[] | null;
  release_date: string | null;
  type: 'major' | 'minor' | 'patch' | null;
}> {
  try {
    // Fetch ALL versions and sort by version number (not date)
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, notes, release_date, detected_at, type')
      .eq('software_id', softwareId);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        version: null,
        notes: null,
        release_date: null,
        type: null
      };
    }

    // Sort by version number to get the true latest version
    const sortedVersions = data.sort((a, b) => compareVersions(b.version, a.version));
    const latestVersion = sortedVersions[0];

    return {
      version: latestVersion.version,
      notes: latestVersion.notes,
      release_date: latestVersion.release_date || latestVersion.detected_at,
      type: latestVersion.type
    };
  } catch (err) {
    console.error('Error fetching latest version:', err);
    return {
      version: null,
      notes: null,
      release_date: null,
      type: null
    };
  }
}