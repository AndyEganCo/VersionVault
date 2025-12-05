// Version comparison utilities for newsletter notifications
// Only notify users about versions NEWER than their current version

import type { ParsedVersion, VersionCompareResult } from './types';

/**
 * Parse a version string into components
 * Handles various formats: 1.0.0, v1.0.0, 1.0, 1.0.0-beta, r32.1.4, 2025.31760
 */
export function parseVersion(version: string): ParsedVersion {
  const raw = version;

  // Remove leading 'v' or 'r' prefix
  let cleaned = version.replace(/^[vr]/i, '').trim();

  // Extract prerelease/build info (everything after -)
  let prerelease: string | undefined;
  let build: string | undefined;

  const prereleaseMatch = cleaned.match(/^([^-+]+)(?:-([^+]+))?(?:\+(.+))?$/);
  if (prereleaseMatch) {
    cleaned = prereleaseMatch[1];
    prerelease = prereleaseMatch[2];
    build = prereleaseMatch[3];
  }

  // Split by dots and parse numbers
  const parts = cleaned.split('.').map(p => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease,
    build,
    raw,
  };
}

/**
 * Compare two versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): VersionCompareResult {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare major
  if (vA.major !== vB.major) {
    return vA.major > vB.major ? 1 : -1;
  }

  // Compare minor
  if (vA.minor !== vB.minor) {
    return vA.minor > vB.minor ? 1 : -1;
  }

  // Compare patch
  if (vA.patch !== vB.patch) {
    return vA.patch > vB.patch ? 1 : -1;
  }

  // Handle prerelease (no prerelease > has prerelease)
  // e.g., 1.0.0 > 1.0.0-beta
  if (!vA.prerelease && vB.prerelease) return 1;
  if (vA.prerelease && !vB.prerelease) return -1;

  // If both have prerelease, compare alphabetically
  if (vA.prerelease && vB.prerelease) {
    if (vA.prerelease > vB.prerelease) return 1;
    if (vA.prerelease < vB.prerelease) return -1;
  }

  return 0;
}

/**
 * Check if newVersion is strictly newer than currentVersion
 * Used to determine if we should notify about a version
 */
export function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  return compareVersions(newVersion, currentVersion) === 1;
}

/**
 * Determine the type of update based on version change
 */
export function getUpdateType(
  oldVersion: string,
  newVersion: string
): 'major' | 'minor' | 'patch' {
  const oldParsed = parseVersion(oldVersion);
  const newParsed = parseVersion(newVersion);

  if (newParsed.major > oldParsed.major) {
    return 'major';
  }

  if (newParsed.minor > oldParsed.minor) {
    return 'minor';
  }

  return 'patch';
}

/**
 * Filter updates to only include versions newer than last notified
 * This prevents sending notifications for old versions discovered during backfill
 */
export function filterNewerUpdates<T extends { new_version: string; old_version: string }>(
  updates: T[],
  lastNotifiedVersion: string | null
): T[] {
  if (!lastNotifiedVersion) {
    // Never notified before, include all updates
    return updates;
  }

  return updates.filter(update =>
    isNewerVersion(update.new_version, lastNotifiedVersion)
  );
}

/**
 * Sort updates by version (newest first)
 */
export function sortUpdatesByVersion<T extends { new_version: string }>(
  updates: T[]
): T[] {
  return [...updates].sort((a, b) =>
    compareVersions(b.new_version, a.new_version)
  );
}

/**
 * Get the latest version from a list of updates
 */
export function getLatestVersion(updates: Array<{ new_version: string }>): string | null {
  if (updates.length === 0) return null;

  const sorted = sortUpdatesByVersion(updates);
  return sorted[0].new_version;
}
