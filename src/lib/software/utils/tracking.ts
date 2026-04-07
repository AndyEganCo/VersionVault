import { supabase } from '@/lib/supabase';

export const FREE_TIER_TRACKING_LIMIT = 5;

// VersionVault is excluded from the free tier tracking limit
// (we want users to keep it tracked for their own update notifications)
let cachedVersionVaultId: string | null | undefined = undefined;

export async function getVersionVaultSoftwareId(): Promise<string | null> {
  if (cachedVersionVaultId !== undefined) {
    return cachedVersionVaultId;
  }

  try {
    const { data } = await supabase
      .from('software')
      .select('id, name')
      .or('name.ilike.%versionvault%,name.ilike.%version vault%');

    const vv = data?.find(s =>
      s.name.toLowerCase().includes('versionvault') ||
      s.name.toLowerCase().includes('version vault')
    );

    cachedVersionVaultId = vv?.id ?? null;
    return cachedVersionVaultId;
  } catch (error) {
    console.error('Error finding VersionVault software:', error);
    return null;
  }
}

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

export async function getTrackedCount(userId: string): Promise<number> {
  const vvId = await getVersionVaultSoftwareId();

  let query = supabase
    .from('tracked_software')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Exclude VersionVault from the count (doesn't count toward free tier limit)
  if (vvId) {
    query = query.neq('software_id', vvId);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error fetching tracked count:', error);
    return 0;
  }

  return count ?? 0;
}

export async function toggleSoftwareTracking(
  userId: string,
  softwareId: string,
  isTracking: boolean,
  isPremium: boolean = false
): Promise<boolean> {
  try {
    if (isTracking) {
      // Enforce tracking limit for free users
      if (!isPremium) {
        const count = await getTrackedCount(userId);
        if (count >= FREE_TIER_TRACKING_LIMIT) {
          throw new Error('TRACKING_LIMIT_REACHED');
        }
      }

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
    if (error instanceof Error && error.message === 'TRACKING_LIMIT_REACHED') {
      throw error;
    }
    console.error('Error toggling software tracking:', error);
    return false;
  }
}