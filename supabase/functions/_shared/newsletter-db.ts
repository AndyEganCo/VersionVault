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
 * Get current versions for multiple software using Postgres batch function
 * This is optimized for users tracking 1000+ software
 */
export async function getCurrentVersionsBatch(
  supabase: SupabaseClient,
  softwareIds: string[]
) {
  if (softwareIds.length === 0) return []

  const { data, error } = await supabase
    .rpc('get_current_versions_batch', {
      software_ids: softwareIds
    })

  if (error) {
    throw new Error(`Failed to fetch current versions: ${error.message}`)
  }

  return data || []
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
  const { data, error } = await supabase
    .from('tracked_software')
    .select(`
      software_id,
      tracked_at,
      software:software_id (
        id,
        name,
        manufacturer,
        category
      )
    `)
    .eq('user_id', userId)
    .gte('tracked_at', sinceDate.toISOString())

  if (error) {
    throw new Error(`Failed to fetch new software: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  // Get current versions for new software
  const softwareIds = data.map(d => d.software_id)
  const currentVersions = await getCurrentVersionsBatch(supabase, softwareIds)

  // Map current versions
  const versionMap = new Map(
    currentVersions.map(v => [v.software_id, v.current_version])
  )

  return data.map(item => ({
    software_id: item.software_id,
    name: item.software.name,
    manufacturer: item.software.manufacturer,
    category: item.software.category,
    initial_version: versionMap.get(item.software_id) || 'N/A',
    added_date: item.tracked_at
  }))
}
