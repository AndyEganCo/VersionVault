import { supabase } from '@/lib/supabase';
import type { Software } from '../types';
import { compareVersions, getCurrentVersionFromHistory } from '@/lib/utils/version-utils';

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

  // Then get latest version for each software from version history
  // NOTE: current_version is COMPUTED from software_version_history using semantic versioning
  const softwareWithVersions = await Promise.all(
    softwareData.map(async (software) => {
      // Fetch ALL verified versions
      const { data: allVersions } = await supabase
        .from('software_version_history')
        .select('version, notes, type, release_date, detected_at, newsletter_verified, is_current_override')
        .eq('software_id', software.id)
        .eq('newsletter_verified', true);

      // Get current version using semantic version comparison (highest version = current)
      const currentVersion = getCurrentVersionFromHistory(allVersions || [], true);

      return {
        ...software,
        current_version: currentVersion?.version || null,
        release_date: currentVersion?.release_date || currentVersion?.detected_at || null,
        release_notes: currentVersion ? [{
          version: currentVersion.version,
          date: currentVersion.release_date || currentVersion.detected_at,
          notes: Array.isArray(currentVersion.notes) ? currentVersion.notes : [currentVersion.notes],
          type: currentVersion.type
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
    // Fetch ALL verified versions
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, notes, release_date, detected_at, type, newsletter_verified, is_current_override')
      .eq('software_id', softwareId)
      .eq('newsletter_verified', true);

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

    // Get current version using semantic version comparison (highest version = current)
    const currentVersion = getCurrentVersionFromHistory(data, true);

    if (!currentVersion) {
      return {
        version: null,
        notes: null,
        release_date: null,
        type: null
      };
    }

    return {
      version: currentVersion.version,
      notes: currentVersion.notes,
      release_date: currentVersion.release_date || currentVersion.detected_at,
      type: currentVersion.type
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