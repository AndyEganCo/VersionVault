// Newsletter Database Utilities
// Shared database query functions for newsletter operations

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Get tracked software for a user
 */
export async function getTrackedSoftware(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('tracked_software')
    .select('software_id, last_notified_version, last_notified_at')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch tracked software: ${error.message}`)
  }

  return data || []
}

/**
 * Get current versions for multiple software
 * Uses the same logic as getCurrentVersionFromHistory() to ensure consistency
 * This is optimized for users tracking 1000+ software by batching queries
 */
export async function getCurrentVersionsBatch(
  supabase: SupabaseClient,
  softwareIds: string[]
) {
  if (softwareIds.length === 0) return []

  // Import the version comparison utility
  const { getCurrentVersionFromHistory } = await import('./version-utils.ts')

  // Fetch ALL version history for the software IDs
  // Filter to newsletter_verified = true (only explicitly verified versions, same as webapp)
  const { data: allVersions, error } = await supabase
    .from('software_version_history')
    .select('software_id, version, release_date, detected_at, notes, type, is_current_override, newsletter_verified')
    .in('software_id', softwareIds)
    .eq('newsletter_verified', true)

  if (error) {
    throw new Error(`Failed to fetch version history: ${error.message}`)
  }

  if (!allVersions || allVersions.length === 0) return []

  // Group versions by software_id
  const versionsBySoftware = new Map<string, typeof allVersions>()
  for (const version of allVersions) {
    const softwareId = version.software_id
    if (!versionsBySoftware.has(softwareId)) {
      versionsBySoftware.set(softwareId, [])
    }
    versionsBySoftware.get(softwareId)!.push(version)
  }

  // Use getCurrentVersionFromHistory() to find the current version for each software
  const results = []
  for (const softwareId of softwareIds) {
    const versions = versionsBySoftware.get(softwareId)
    if (!versions || versions.length === 0) continue

    const currentVersion = getCurrentVersionFromHistory(versions, true)
    if (currentVersion) {
      results.push({
        software_id: softwareId,
        current_version: currentVersion.version,
        release_date: currentVersion.release_date,
        detected_at: currentVersion.detected_at,
        notes: currentVersion.notes,
        type: currentVersion.type
      })
    }
  }

  return results
}

/**
 * Get software details for multiple IDs
 */
export async function getSoftwareDetails(
  supabase: SupabaseClient,
  softwareIds: string[]
) {
  if (softwareIds.length === 0) return []

  const { data, error } = await supabase
    .from('software')
    .select('id, name, manufacturer, category')
    .in('id', softwareIds)

  if (error) {
    throw new Error(`Failed to fetch software details: ${error.message}`)
  }

  return data || []
}

/**
 * Check hard bounce count for a user in last 30 days
 */
export async function checkBounces(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { count, error } = await supabase
    .from('email_bounces')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('bounce_type', 'hard')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (error) {
    console.error(`Error checking bounces for ${userId}:`, error)
    return 0
  }

  return count || 0
}

/**
 * Update last_notified_version for tracked software
 */
export async function updateLastNotified(
  supabase: SupabaseClient,
  userId: string,
  updates: Array<{ software_id: string; version: string }>
) {
  const now = new Date().toISOString()

  for (const update of updates) {
    const { error } = await supabase
      .from('tracked_software')
      .update({
        last_notified_version: update.version,
        last_notified_at: now
      })
      .eq('user_id', userId)
      .eq('software_id', update.software_id)

    if (error) {
      console.error(`Failed to update last_notified for ${update.software_id}:`, error)
      // Continue with other updates even if one fails
    }
  }
}

/**
 * Get active newsletter sponsor
 */
export async function getActiveSponsor(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('newsletter_sponsors')
    .select('*')
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Error fetching sponsor:', error)
  }

  return data || null
}

/**
 * Increment sponsor impression count
 */
export async function incrementSponsorImpressions(
  supabase: SupabaseClient,
  sponsorId: string
) {
  const { error } = await supabase
    .rpc('increment', {
      table_name: 'newsletter_sponsors',
      row_id: sponsorId,
      column_name: 'impression_count'
    })

  if (error) {
    console.error(`Failed to increment sponsor impressions:`, error)
  }
}

/**
 * Get newly added software to the platform (not tracked by user yet)
 * This shows software recently added to VersionVault that the user might want to track
 */
export async function getNewSoftware(
  supabase: SupabaseClient,
  userId: string,
  sinceDate: Date
) {
  // Get software added to the platform in the time period
  const { data: newSoftwareData, error: softwareError } = await supabase
    .from('software')
    .select('id, name, manufacturer, category, created_at')
    .gte('created_at', sinceDate.toISOString())
    .order('created_at', { ascending: false }) // Newest first

  if (softwareError) {
    throw new Error(`Failed to fetch new software: ${softwareError.message}`)
  }

  if (!newSoftwareData || newSoftwareData.length === 0) return []

  // Get software the user is already tracking
  const { data: trackedData, error: trackedError } = await supabase
    .from('tracked_software')
    .select('software_id')
    .eq('user_id', userId)

  if (trackedError) {
    throw new Error(`Failed to fetch tracked software: ${trackedError.message}`)
  }

  // Create a set of tracked software IDs for fast lookup
  const trackedIds = new Set(trackedData?.map(t => t.software_id) || [])

  // Filter out software the user is already tracking
  const untrackedSoftware = newSoftwareData.filter(s => !trackedIds.has(s.id))

  if (untrackedSoftware.length === 0) return []

  const softwareIds = untrackedSoftware.map(s => s.id)

  // Get current versions for the new software
  const currentVersions = await getCurrentVersionsBatch(supabase, softwareIds)

  // Create version map
  const versionMap = new Map(
    currentVersions.map(v => [v.software_id, v.current_version])
  )

  // Combine the data (already sorted by created_at descending)
  return untrackedSoftware.map(software => ({
    software_id: software.id,
    name: software.name,
    manufacturer: software.manufacturer,
    category: software.category,
    initial_version: versionMap.get(software.id) || 'N/A',
    added_date: software.created_at
  }))
}
