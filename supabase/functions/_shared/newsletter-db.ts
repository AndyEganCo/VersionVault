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
  // Filter to newsletter_verified != false (includes true and null)
  const { data: allVersions, error } = await supabase
    .from('software_version_history')
    .select('software_id, version, release_date, detected_at, notes, type, is_current_override, newsletter_verified')
    .in('software_id', softwareIds)
    .neq('newsletter_verified', false)

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
 * Get newly added software for a user in the time period
 */
export async function getNewSoftware(
  supabase: SupabaseClient,
  userId: string,
  sinceDate: Date
) {
  // Get tracked software added in the time period
  const { data: trackedData, error: trackedError } = await supabase
    .from('tracked_software')
    .select('software_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceDate.toISOString())

  if (trackedError) {
    throw new Error(`Failed to fetch new software: ${trackedError.message}`)
  }

  if (!trackedData || trackedData.length === 0) return []

  const softwareIds = trackedData.map(d => d.software_id)

  // Get software details using the existing utility
  const softwareDetails = await getSoftwareDetails(supabase, softwareIds)

  // Get current versions
  const currentVersions = await getCurrentVersionsBatch(supabase, softwareIds)

  // Create maps for easy lookup
  const softwareMap = new Map(
    softwareDetails.map(s => [s.id, s])
  )
  const versionMap = new Map(
    currentVersions.map(v => [v.software_id, v.current_version])
  )

  // Combine the data
  return trackedData
    .map(tracked => {
      const software = softwareMap.get(tracked.software_id)
      if (!software) return null // Skip if software not found

      return {
        software_id: tracked.software_id,
        name: software.name,
        manufacturer: software.manufacturer,
        category: software.category,
        initial_version: versionMap.get(tracked.software_id) || 'N/A',
        added_date: tracked.created_at
      }
    })
    .filter(Boolean) // Remove nulls
}
