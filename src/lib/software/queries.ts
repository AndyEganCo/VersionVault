import { supabase } from '@/lib/supabase';
import type { Software } from './types';

export async function getAllSoftware(): Promise<Software[]> {
  // First get all software
  const { data: softwareData, error } = await supabase
    .from('software')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching software:', error);
    throw new Error('Failed to fetch software');
  }

  // Get latest version info for each software
  const softwareWithDates = await Promise.all(
    softwareData.map(async (software) => {
      try {
        const { data: versionHistory } = await supabase
          .from('software_version_history')
          .select('release_date, last_checked, version, notes, type')
          .eq('software_id', software.id)
          .order('release_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!versionHistory) {
          return software;
        }

        return {
          ...software,
          release_date: versionHistory.release_date || software.release_date,
          last_checked: versionHistory.last_checked || software.last_checked,
          current_version: versionHistory.version || software.current_version
        };
      } catch (err) {
        console.error(`Error fetching version history for software ${software.id}:`, err);
        return software;
      }
    })
  );

  return softwareWithDates;
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
  last_checked: string | null;
  type: 'major' | 'minor' | 'patch' | null;
}> {
  try {
    const { data, error } = await supabase
      .from('software_version_history')
      .select('version, notes, release_date, last_checked, type')
      .eq('software_id', softwareId)
      .order('release_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data) {
      // Return null values if no version history exists
      return {
        version: null,
        notes: null,
        release_date: null,
        last_checked: null,
        type: null
      };
    }

    return {
      version: data.version,
      notes: data.notes,
      release_date: data.release_date,
      last_checked: data.last_checked,
      type: data.type
    };
  } catch (err) {
    console.error('Error fetching latest version:', err);
    // Return null values on error
    return {
      version: null,
      notes: null,
      release_date: null,
      last_checked: null,
      type: null
    };
  }
}