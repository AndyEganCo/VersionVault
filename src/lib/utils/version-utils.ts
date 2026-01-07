/**
 * Shared version comparison utilities (Frontend)
 *
 * This is the SINGLE SOURCE OF TRUTH for version comparison logic.
 * This file mirrors the backend version-utils.ts for consistency.
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
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  // Remove common prefixes like 'v', 'r', 'version', etc.
  const clean1 = v1.replace(/^[vr]|version\s*/i, '').trim();
  const clean2 = v2.replace(/^[vr]|version\s*/i, '').trim();

  // Split on prerelease marker (-, _)
  const [main1, prerelease1] = clean1.split(/[-_]/);
  const [main2, prerelease2] = clean2.split(/[-_]/);

  // Split main version into parts (1.5.0 -> [1, 5, 0])
  const parts1 = main1.split(/[.]/).map(p => parseInt(p, 10) || 0);
  const parts2 = main2.split(/[.]/).map(p => parseInt(p, 10) || 0);

  // Compare each part of the main version
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  // If main versions are equal, check prerelease
  // Versions without prerelease are considered HIGHER than those with prerelease
  // Example: 1.0.0 > 1.0.0-beta
  if (!prerelease1 && prerelease2) return 1;  // v1 is release, v2 is prerelease
  if (prerelease1 && !prerelease2) return -1; // v1 is prerelease, v2 is release

  // Both have prerelease, compare alphabetically
  if (prerelease1 && prerelease2) {
    return prerelease1.localeCompare(prerelease2);
  }

  return 0;
}

/**
 * Check if a version is semantically newer than another
 */
export function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  return compareVersions(newVersion, currentVersion) > 0;
}

/**
 * Sort versions in descending order (highest version first)
 */
export function sortVersionsDescending(versions: string[]): string[] {
  return versions.sort((a, b) => compareVersions(b, a));
}

/**
 * Get the highest (current) version from an array of version history entries
 * This is how we determine "current version" - always take the highest semantic version
 *
 * @param history Array of version history entries with 'version' field
 * @param onlyVerified If true, only consider newsletter_verified versions (default: true)
 * @returns The version history entry with the highest semantic version, or null
 */
export function getCurrentVersionFromHistory<T extends { version: string; newsletter_verified?: boolean }>(
  history: T[],
  onlyVerified: boolean = true
): T | null {
  if (!history || history.length === 0) return null;

  // Filter to verified versions if requested
  const filteredHistory = onlyVerified
    ? history.filter(h => h.newsletter_verified !== false)
    : history;

  if (filteredHistory.length === 0) return null;

  // Sort by semantic version (highest first) and return the first one
  const sorted = filteredHistory.sort((a, b) => compareVersions(b.version, a.version));
  return sorted[0];
}

/**
 * Normalize version numbers for software that uses non-standard formats
 * For disguise: strip the 'r' prefix (e.g., "r32.2" -> "32.2")
 *
 * This should be called BEFORE storing versions in the database
 */
export function normalizeVersion(version: string, softwareName: string): string {
  if (!version) return version;

  const lowerName = softwareName.toLowerCase();

  // Handle disguise versions - strip 'r' prefix
  if (lowerName.includes('disguise') || lowerName.includes('designer')) {
    // Match versions like "r32.2", "r32.1.4" but not "version 32.2"
    const match = version.match(/^r(\d+(?:\.\d+)*)$/i);
    if (match) {
      return match[1];
    }
  }

  return version;
}
