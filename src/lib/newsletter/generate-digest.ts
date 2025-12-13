// Digest Generation Logic
// Generates personalized newsletter content for each user

import { supabase } from '@/lib/supabase';
import type { SoftwareUpdateSummary, SponsorData, NewsletterPayload, NewSoftwareSummary } from './types';
import { isNewerVersion, getUpdateType } from './version-compare';
import { getRandomAllQuietMessage, MAX_UPDATES_PER_EMAIL } from './index';

interface TrackedSoftwareWithHistory {
  software_id: string;
  last_notified_version: string | null;
  software: {
    id: string;
    name: string;
    manufacturer: string;
    category: string;
    current_version: string | null;
    release_date: string | null;
  };
}

interface VersionHistoryItem {
  software_id: string;
  version: string;
  release_date: string;
  detected_at: string;
  notes: string[] | null;
  type: 'major' | 'minor' | 'patch' | null;
}

/**
 * Generate digest content for a single user
 */
export async function generateUserDigest(
  userId: string,
  sinceDays: number = 7
): Promise<{
  updates: SoftwareUpdateSummary[];
  hasUpdates: boolean;
  allQuietMessage?: string;
}> {
  // Get user's tracked software with their last notified version
  const { data: trackedSoftware, error: trackedError } = await supabase
    .from('tracked_software')
    .select(`
      software_id,
      last_notified_version,
      software:software_id (
        id,
        name,
        manufacturer,
        category,
        current_version,
        release_date
      )
    `)
    .eq('user_id', userId);

  if (trackedError || !trackedSoftware || trackedSoftware.length === 0) {
    return {
      updates: [],
      hasUpdates: false,
      allQuietMessage: getRandomAllQuietMessage(),
    };
  }

  // Calculate the date cutoff
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDays);

  // Get software IDs the user is tracking
  const softwareIds = trackedSoftware.map(t => t.software_id);

  // Get ALL verified version history for tracked software
  // We need the full history to find the previous version for each software
  const { data: allVersionHistory, error: historyError } = await supabase
    .from('software_version_history')
    .select('software_id, version, release_date, detected_at, notes, type')
    .in('software_id', softwareIds)
    .eq('newsletter_verified', true)
    .order('software_id')
    .order('release_date', { ascending: false, nullsLast: true })
    .order('detected_at', { ascending: false });

  if (historyError) {
    console.error('Failed to fetch version history:', historyError);
    return {
      updates: [],
      hasUpdates: false,
      allQuietMessage: getRandomAllQuietMessage(),
    };
  }

  // Build a map of software info for quick lookup
  const softwareMap = new Map<string, TrackedSoftwareWithHistory['software']>();
  const lastNotifiedMap = new Map<string, string | null>();

  for (const tracked of trackedSoftware as unknown as TrackedSoftwareWithHistory[]) {
    if (tracked.software) {
      softwareMap.set(tracked.software_id, tracked.software);
      lastNotifiedMap.set(tracked.software_id, tracked.last_notified_version);
    }
  }

  // Group version history by software_id
  const versionHistoryBySoftware = new Map<string, VersionHistoryItem[]>();
  for (const history of (allVersionHistory || []) as VersionHistoryItem[]) {
    if (!versionHistoryBySoftware.has(history.software_id)) {
      versionHistoryBySoftware.set(history.software_id, []);
    }
    versionHistoryBySoftware.get(history.software_id)!.push(history);
  }

  // Process each tracked software to find updates
  const updates: SoftwareUpdateSummary[] = [];

  for (const tracked of trackedSoftware as unknown as TrackedSoftwareWithHistory[]) {
    const software = tracked.software;
    if (!software || !software.current_version) continue;

    const histories = versionHistoryBySoftware.get(tracked.software_id) || [];
    if (histories.length === 0) continue;

    // Find the current version in the history
    const currentVersionEntry = histories.find(h => h.version === software.current_version);
    if (!currentVersionEntry) continue;

    // Check if the current version was released in the time period
    const releaseDate = currentVersionEntry.release_date || currentVersionEntry.detected_at;
    const releaseDateObj = new Date(releaseDate);
    if (releaseDateObj < sinceDate) {
      // Current version was released before the time period, skip
      continue;
    }

    // Find the previous version (the next one in the sorted array)
    const currentIndex = histories.indexOf(currentVersionEntry);
    const previousVersionEntry = currentIndex < histories.length - 1 ? histories[currentIndex + 1] : null;

    // Determine old version
    const oldVersion = previousVersionEntry?.version || lastNotifiedMap.get(tracked.software_id) || 'N/A';

    updates.push({
      software_id: tracked.software_id,
      name: software.name,
      manufacturer: software.manufacturer,
      category: software.category,
      old_version: oldVersion,
      new_version: software.current_version,
      release_date: releaseDate,
      release_notes: currentVersionEntry.notes || undefined,
      update_type: currentVersionEntry.type || getUpdateType(oldVersion, software.current_version),
    });
  }

  // Limit updates to prevent massive emails
  const limitedUpdates = updates.slice(0, MAX_UPDATES_PER_EMAIL);

  return {
    updates: limitedUpdates,
    hasUpdates: limitedUpdates.length > 0,
    allQuietMessage: limitedUpdates.length === 0 ? getRandomAllQuietMessage() : undefined,
  };
}

/**
 * Get the active sponsor for inclusion in emails
 */
export async function getActiveSponsor(): Promise<SponsorData | null> {
  const { data, error } = await supabase
    .from('newsletter_sponsors')
    .select('*')
    .eq('is_active', true)
    .gte('end_date', new Date().toISOString().split('T')[0])
    .lte('start_date', new Date().toISOString().split('T')[0])
    .single();

  if (error || !data) {
    // Try without date constraints
    const { data: fallback } = await supabase
      .from('newsletter_sponsors')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!fallback) return null;

    return {
      name: fallback.name,
      tagline: fallback.tagline,
      description: fallback.description,
      image_url: fallback.image_url,
      cta_url: fallback.cta_url,
      cta_text: fallback.cta_text,
    };
  }

  return {
    name: data.name,
    tagline: data.tagline,
    description: data.description,
    image_url: data.image_url,
    cta_url: data.cta_url,
    cta_text: data.cta_text,
  };
}

/**
 * Get newly added software in the time period
 */
export async function getNewSoftware(
  sinceDays: number = 7
): Promise<NewSoftwareSummary[]> {
  // Calculate the date cutoff
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDays);

  // Get software added in the time period
  const { data: newSoftware, error } = await supabase
    .from('software')
    .select('id, name, manufacturer, category, current_version, created_at')
    .gte('created_at', sinceDate.toISOString())
    .order('created_at', { ascending: false });

  if (error || !newSoftware) {
    console.error('Failed to fetch new software:', error);
    return [];
  }

  return newSoftware.map(software => ({
    software_id: software.id,
    name: software.name,
    manufacturer: software.manufacturer,
    category: software.category,
    initial_version: software.current_version || 'N/A',
    added_date: software.created_at,
  }));
}

/**
 * Generate full newsletter payload for a user
 */
export async function generateNewsletterPayload(
  userId: string,
  sinceDays: number = 7
): Promise<NewsletterPayload> {
  const [digest, sponsor, newSoftware] = await Promise.all([
    generateUserDigest(userId, sinceDays),
    getActiveSponsor(),
    getNewSoftware(sinceDays),
  ]);

  return {
    updates: digest.updates,
    newSoftware: newSoftware.length > 0 ? newSoftware : undefined,
    sponsor,
    all_quiet_message: digest.allQuietMessage,
  };
}

/**
 * Update the last_notified_version for a user's tracked software
 * Call this AFTER successfully sending the newsletter
 */
export async function updateLastNotifiedVersions(
  userId: string,
  updates: SoftwareUpdateSummary[]
): Promise<void> {
  if (updates.length === 0) return;

  const now = new Date().toISOString();

  // Update each tracked software with the version we just notified about
  for (const update of updates) {
    await supabase
      .from('tracked_software')
      .update({
        last_notified_version: update.new_version,
        last_notified_at: now,
      })
      .eq('user_id', userId)
      .eq('software_id', update.software_id);
  }
}

/**
 * Get users who should receive a digest based on their settings
 */
export async function getUsersForDigest(
  frequency: 'daily' | 'weekly' | 'monthly'
): Promise<Array<{ userId: string; email: string; timezone: string }>> {
  const { data, error } = await supabase
    .from('user_settings')
    .select(`
      user_id,
      timezone,
      users:user_id (
        email
      )
    `)
    .eq('email_notifications', true)
    .eq('notification_frequency', frequency);

  if (error || !data) {
    console.error('Failed to get users for digest:', error);
    return [];
  }

  // Filter out users with too many hard bounces
  const users: Array<{ userId: string; email: string; timezone: string }> = [];

  for (const row of data) {
    // Check bounce count
    const { count } = await supabase
      .from('email_bounces')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', row.user_id)
      .eq('bounce_type', 'hard')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if ((count || 0) >= 3) {
      // Too many bounces, skip this user
      continue;
    }

    const userEmail = (row.users as unknown as { email: string } | null)?.email;
    if (userEmail) {
      users.push({
        userId: row.user_id,
        email: userEmail,
        timezone: row.timezone || 'America/New_York',
      });
    }
  }

  return users;
}
