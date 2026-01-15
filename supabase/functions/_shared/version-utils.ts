/**
 * Shared version comparison utilities
 *
 * This is the SINGLE SOURCE OF TRUTH for version comparison logic.
 * All parts of the system (frontend, backend, edge functions) should use these functions.
 *
 * IMPORTANT: When determining "current version", always use the highest semantic version
 * from software_version_history, NOT the software.current_version database field.
 */

/**
 * Compare two version strings using semantic versioning rules
 *
 * Handles formats like:
 * - 1.0.0, v1.0.0, r1.0.0
 * - 2.5, 10.15.3
 * - 2025.1234 (year-based)
 * - 1.0.0-beta, 1.0.0-alpha
 *
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  // Handle null/undefined
  if (!v1 && !v2) return 0
  if (!v1) return -1
  if (!v2) return 1

  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim()
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim()

  // Split on prerelease marker (-, _)
  const [main1, prerelease1] = clean1.split(/[-_]/)
  const [main2, prerelease2] = clean2.split(/[-_]/)

  // Split main version into parts (1.5.0 -> [1, 5, 0])
  const parts1 = main1.split(/[.]/).map(p => parseInt(p, 10) || 0)
  const parts2 = main2.split(/[.]/).map(p => parseInt(p, 10) || 0)

  // Compare each part of the main version
  const maxLength = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0

    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  // If main versions are equal, check prerelease
  // Versions without prerelease are considered HIGHER than those with prerelease
  // Example: 1.0.0 > 1.0.0-beta
  if (!prerelease1 && prerelease2) return 1  // v1 is release, v2 is prerelease
  if (prerelease1 && !prerelease2) return -1 // v1 is prerelease, v2 is release

  // Both have prerelease, compare alphabetically
  if (prerelease1 && prerelease2) {
    return prerelease1.localeCompare(prerelease2)
  }

  return 0
}

/**
 * Check if a version is semantically newer than another
 */
export function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  return compareVersions(newVersion, currentVersion) > 0
}

/**
 * Sort versions in descending order (highest version first)
 */
export function sortVersionsDescending(versions: string[]): string[] {
  return versions.sort((a, b) => compareVersions(b, a))
}

/**
 * Check if a version string looks like valid semantic versioning
 * @param version Version string to check
 * @returns true if version starts with digits (likely semver), false otherwise
 */
function isValidSemver(version: string): boolean {
  // Check if version starts with a number (e.g., "1.2.3", "2.0", "5.0.512")
  return /^\d+(\.\d+)*/.test(version.trim())
}

/**
 * Get the highest (current) version from an array of version history entries
 * This is how we determine "current version" using the following priority:
 * 1. Manual override (is_current_override = true)
 * 2. Highest semantic version (if versions are valid semver)
 * 3. Most recent date (for name-based versions)
 *
 * MANUAL OVERRIDE:
 * Admins can manually set a version as "current" by setting is_current_override = true.
 * This overrides all automatic detection.
 *
 * FALLBACK FOR NAME-BASED VERSIONS:
 * For software that uses name-based versions (e.g., "Config 2025", "February Update"),
 * we detect that they're not valid semver and fall back to sorting by date.
 *
 * @param history Array of version history entries with 'version' field
 * @param onlyVerified If true, only consider newsletter_verified versions (default: true)
 * @returns The version history entry that is considered "current", or null
 */
export function getCurrentVersionFromHistory<T extends { version: string; newsletter_verified?: boolean; release_date?: string; detected_at?: string; is_current_override?: boolean }>(
  history: T[],
  onlyVerified: boolean = true
): T | null {
  if (!history || history.length === 0) return null

  // Filter to verified versions if requested
  const filteredHistory = onlyVerified
    ? history.filter(h => h.newsletter_verified !== false)
    : history

  if (filteredHistory.length === 0) return null

  // PRIORITY 1: Check for manual override first
  const manualOverride = filteredHistory.find(h => h.is_current_override === true)
  if (manualOverride) {
    return manualOverride
  }

  // PRIORITY 2/3: Check if versions are valid semver or name-based
  // If ANY version is not valid semver, treat all as name-based and sort by date
  const allVersionsAreSemver = filteredHistory.every(entry => isValidSemver(entry.version))

  if (!allVersionsAreSemver) {
    // Name-based versions: sort by date (newest first)
    const dateSorted = [...filteredHistory].sort((a, b) => {
      const dateA = a.release_date || a.detected_at || '1970-01-01'
      const dateB = b.release_date || b.detected_at || '1970-01-01'
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
    return dateSorted[0]
  }

  // Valid semver versions: sort by semantic version (highest first)
  const sorted = [...filteredHistory].sort((a, b) => compareVersions(b.version, a.version))
  return sorted[0]
}

/**
 * Normalize version numbers to merge duplicates with slight format variations
 *
 * Handles cases like:
 * - "r32" and "32" → "32"
 * - "v125" and "125" → "125"
 * - "cobra_v125" and "v125" → "125"
 * - "version 1.2.3" and "1.2.3" → "1.2.3"
 *
 * But preserves different actual versions:
 * - "2025.252" and "2025.255" → kept as different versions
 *
 * This should be called BEFORE storing versions in the database and BEFORE
 * checking for duplicates.
 *
 * @param version Raw version string
 * @param softwareName Software name for context-specific normalization
 * @returns Normalized version string
 */
export function normalizeVersion(version: string, softwareName: string): string {
  if (!version) return version

  let normalized = version.trim()
  const lowerName = softwareName.toLowerCase()

  // Step 1: Strip software-specific prefixes (e.g., "cobra_v125" → "v125")
  // Create regex pattern that matches: softwarename_v, softwarename_version, softwarename-v, etc.
  const softwarePrefix = lowerName.replace(/[^a-z0-9]/g, '') // Remove spaces/special chars
  if (softwarePrefix) {
    const softwarePattern = new RegExp(`^${softwarePrefix}[_\\-\\s]*(v|version)?[_\\-\\s]*`, 'i')
    normalized = normalized.replace(softwarePattern, '')
  }

  // Step 2: Strip common version prefixes
  // Match: "v", "r", "version ", "ver ", "release " followed by a number
  // But NOT if it's part of a larger word (e.g., "Config 2025" should keep "Config")
  normalized = normalized.replace(/^(v|r|version|ver|release)[\s\-_]*(?=\d)/i, '')

  // Step 3: Clean up whitespace
  normalized = normalized.trim()

  return normalized
}

/**
 * Interface for version history entry (minimal fields needed)
 */
export interface VersionHistoryEntry {
  version: string
  release_date?: string | null
  detected_at?: string
  newsletter_verified?: boolean
}

/**
 * Check if a version string contains prerelease markers (beta, alpha, rc, etc.)
 * @param version Version string to check
 * @returns true if version contains prerelease markers
 */
export function isBetaVersion(version: string): boolean {
  if (!version) return false
  const clean = version.replace(/^[vr]|version\s*/i, '').trim()
  const [, prerelease] = clean.split(/[-_]/)
  return !!prerelease && /^(alpha|beta|rc|preview|pre|dev|canary)/i.test(prerelease)
}

/**
 * Determine if a version should be ignored based on software name and version type.
 * This implements the filtering logic where:
 * - Software WITHOUT "beta" in name: ignores beta versions, keeps stable
 * - Software WITH "beta" in name: ignores stable versions, keeps beta
 *
 * @param softwareName Name of the software
 * @param version Version string to check
 * @returns true if the version should be ignored, false if it should be kept
 */
export function shouldIgnoreVersion(softwareName: string, version: string): boolean {
  if (!softwareName || !version) return false

  const nameContainsBeta = /beta/i.test(softwareName)
  const versionIsBeta = isBetaVersion(version)

  if (nameContainsBeta) {
    // "Beta" software: ignore stable versions, keep beta/prerelease
    return !versionIsBeta
  } else {
    // Regular software: ignore beta versions, keep stable
    return versionIsBeta
  }
}

/**
 * Get current version info by querying the database directly
 * Use this in edge functions where you can't rely on pre-computed values
 *
 * @param supabase Supabase client
 * @param softwareId Software ID to get current version for
 * @returns Object with current version and release date, or null if no versions
 */
export async function getCurrentVersionFromDatabase(
  supabase: any,
  softwareId: string
): Promise<{ version: string; release_date: string | null } | null> {
  const { data: versions, error } = await supabase
    .from('software_version_history')
    .select('version, release_date, detected_at, newsletter_verified')
    .eq('software_id', softwareId)
    .eq('newsletter_verified', true)

  if (error || !versions || versions.length === 0) {
    return null
  }

  const currentVersion = getCurrentVersionFromHistory(versions, true)

  if (!currentVersion) return null

  return {
    version: currentVersion.version,
    release_date: currentVersion.release_date || currentVersion.detected_at || null
  }
}
