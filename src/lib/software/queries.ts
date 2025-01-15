import { supabase } from '@/lib/supabase';
import type { Software } from './types';

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
      const { data: versionHistory } = await supabase
        .from('software_version_history')
        .select('version, notes, type, release_date')
        .eq('software_id', software.id)
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...software,
        current_version: versionHistory?.version || software.current_version,
        release_date: versionHistory?.release_date || software.release_date,
        release_notes: versionHistory ? [{
          version: versionHistory.version,
          date: versionHistory.release_date,
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
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, notes, release_date, type')
      .eq('software_id', softwareId)
      .order('release_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data) {
      return {
        version: null,
        notes: null,
        release_date: null,
        type: null
      };
    }

    return {
      version: data.version,
      notes: data.notes,
      release_date: data.release_date,
      type: data.type
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