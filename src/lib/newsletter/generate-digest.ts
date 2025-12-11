// Digest Generation Logic
// Generates personalized newsletter content for each user

import { supabase } from '@/lib/supabase';
import type { SoftwareUpdateSummary, SponsorData, NewsletterPayload } from './types';
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
  previous_version: string | null;
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

  // Get version history for tracked software since cutoff
  // Only include verified versions (admin has confirmed data quality)
  // Filter by release_date (or detected_at if release_date is null)
  // This ensures we show software released in the time period, not just detected
  const { data: versionHistory, error: historyError } = await supabase
    .from('software_version_history')
    .select('software_id, version, previous_version, release_date, detected_at, notes, type')
    .in('software_id', softwareIds)
    .eq('newsletter_verified', true)
    .or(`release_date.gte.${sinceDate.toISOString()},and(release_date.is.null,detected_at.gte.${sinceDate.toISOString()})`)
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

  // Process version history into updates
  // Only include versions that match the software's CURRENT version
  // This ensures we only notify about what's currently installed, not intermediate updates
  const updates: SoftwareUpdateSummary[] = [];
  const processedSoftware = new Set<string>();

  for (const history of (versionHistory || []) as VersionHistoryItem[]) {
    // Skip if we already processed an update for this software
    // (we only want the latest update per software in the digest)
    if (processedSoftware.has(history.software_id)) {
      continue;
    }

    const software = softwareMap.get(history.software_id);
    if (!software) continue;

    // CRITICAL: Only include versions that match the software's current version
    // This prevents notifying about intermediate versions that are no longer current
    if (history.version !== software.current_version) {
      continue;
    }

    const lastNotified = lastNotifiedMap.get(history.software_id);

    // Use the previous_version from the database (what it upgraded FROM)
    // Fallback to last notified version if previous_version is missing
    const oldVersion = history.previous_version || lastNotified || 'N/A';

    updates.push({
      software_id: history.software_id,
      name: software.name,
      manufacturer: software.manufacturer,
      category: software.category,
      old_version: oldVersion,
      new_version: history.version,
      release_date: history.release_date || history.detected_at,
      release_notes: history.notes || undefined,
      update_type: history.type || getUpdateType(oldVersion, history.version),
    });

    processedSoftware.add(history.software_id);
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
 * Generate full newsletter payload for a user
 */
export async function generateNewsletterPayload(
  userId: string,
  sinceDays: number = 7
): Promise<NewsletterPayload> {
  const [digest, sponsor] = await Promise.all([
    generateUserDigest(userId, sinceDays),
    getActiveSponsor(),
  ]);

  return {
    updates: digest.updates,
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
